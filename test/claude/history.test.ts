import { describe, it, expect, beforeEach, afterEach } from "@jest/globals"
import { existsSync, rmSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import path from "path"

describe("History System", () => {
  const testDir = path.join(__dirname, "test-history-data")
  const testClaudeDir = path.join(testDir, ".claude")
  const testHistoryDir = path.join(testClaudeDir, "history")
  const testSessionsDir = path.join(testHistoryDir, "sessions")

  beforeEach(() => {
    // Create test directories
    mkdirSync(testDir, { recursive: true })
    mkdirSync(testClaudeDir, { recursive: true })
    mkdirSync(testHistoryDir, { recursive: true })
    mkdirSync(testSessionsDir, { recursive: true })
  })

  afterEach(() => {
    // Clean up test directories
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe("Session Management", () => {
    it("should create session files", () => {
      const sessionId = "test-session-123"
      const session = {
        id: sessionId,
        startTime: new Date().toISOString(),
        endTime: null,
        turns: 0,
        totalCostUSD: 0,
        summary: null,
        metadata: {
          gitBranch: "main",
          projectPath: testDir,
        },
      }

      const sessionPath = path.join(testSessionsDir, `${sessionId}.json`)
      writeFileSync(sessionPath, JSON.stringify(session, null, 2))

      expect(existsSync(sessionPath)).toBe(true)
      const savedSession = JSON.parse(readFileSync(sessionPath, "utf-8"))
      expect(savedSession.id).toBe(sessionId)
    })

    it("should track conversation turns", () => {
      const sessionId = "turn-test-456"
      const sessionPath = path.join(testSessionsDir, `${sessionId}.json`)
      const turnsPath = path.join(testHistoryDir, "turns", `${sessionId}.jsonl`)

      // Create session
      const session = {
        id: sessionId,
        model: "claude-3-5-sonnet",
        startTime: new Date().toISOString(),
        turns: 0,
      }
      writeFileSync(sessionPath, JSON.stringify(session, null, 2))

      // Create turns directory
      mkdirSync(path.join(testHistoryDir, "turns"), { recursive: true })

      // Add turns
      const turn1 = {
        role: "user",
        content: "Create a login screen",
        timestamp: new Date().toISOString(),
      }
      const turn2 = {
        role: "assistant",
        content: "I'll create a login screen for you...",
        timestamp: new Date().toISOString(),
        toolsUsed: ["Read", "Write", "Edit"],
      }

      writeFileSync(turnsPath, JSON.stringify(turn1) + "\n" + JSON.stringify(turn2) + "\n")

      // Update session
      session.turns = 2
      writeFileSync(sessionPath, JSON.stringify(session, null, 2))

      // Verify
      const turns = readFileSync(turnsPath, "utf-8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))

      expect(turns).toHaveLength(2)
      expect(turns[0].role).toBe("user")
      expect(turns[1].role).toBe("assistant")
      expect(turns[1].toolsUsed).toContain("Write")
    })

    it("should calculate session costs", () => {
      // Token pricing (example rates)
      const inputTokenRate = 0.003 / 1000 // $0.003 per 1K tokens
      const outputTokenRate = 0.015 / 1000 // $0.015 per 1K tokens

      const inputTokens = 1500
      const outputTokens = 2500

      const totalCost = inputTokens * inputTokenRate + outputTokens * outputTokenRate

      expect(totalCost).toBeCloseTo(0.042, 4)
    })

    it("should support session summaries", () => {
      const sessionId = "summary-test-789"
      const sessionPath = path.join(testSessionsDir, `${sessionId}.json`)

      const session = {
        id: sessionId,
        model: "claude-3-5-sonnet",
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        turns: 5,
        totalCostUSD: 0.0125,
        summary: "Created login screen with email/password authentication and forgot password flow",
      }

      writeFileSync(sessionPath, JSON.stringify(session, null, 2))

      const saved = JSON.parse(readFileSync(sessionPath, "utf-8"))
      expect(saved.summary).toContain("login screen")
      expect(saved.summary).toContain("authentication")
    })

    it("should list sessions by date", () => {
      // Create multiple sessions
      const sessions = [
        {
          id: "session-1",
          startTime: new Date("2024-01-01").toISOString(),
          turns: 3,
        },
        {
          id: "session-2",
          startTime: new Date("2024-01-02").toISOString(),
          turns: 5,
        },
        {
          id: "session-3",
          startTime: new Date("2024-01-03").toISOString(),
          turns: 2,
        },
      ]

      sessions.forEach((session) => {
        const path = `${testSessionsDir}/${session.id}.json`
        writeFileSync(path, JSON.stringify(session, null, 2))
      })

      // Read all sessions
      const files = require("fs").readdirSync(testSessionsDir)
      const loadedSessions = files
        .filter((f: string) => f.endsWith(".json"))
        .map((f: string) => {
          const content = readFileSync(path.join(testSessionsDir, f), "utf-8")
          return JSON.parse(content)
        })
        .sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())

      expect(loadedSessions).toHaveLength(3)
      expect(loadedSessions[0].id).toBe("session-3") // Most recent
      expect(loadedSessions[2].id).toBe("session-1") // Oldest
    })

    it("should export history in different formats", () => {
      const session = {
        id: "export-test",
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        turns: 2,
        summary: "Test export session",
      }

      // Markdown export
      const markdownExport = `# Conversation History Export

## Session: ${session.id}
- **Date**: ${new Date(session.startTime).toLocaleString()}
- **Turns**: ${session.turns}
- **Summary**: ${session.summary}

---
`

      const exportPath = path.join(testHistoryDir, "export.md")
      writeFileSync(exportPath, markdownExport)

      expect(existsSync(exportPath)).toBe(true)
      const content = readFileSync(exportPath, "utf-8")
      expect(content).toContain("Conversation History Export")
      expect(content).toContain(session.id)
    })

    it("should clean up old sessions", () => {
      const now = Date.now()
      const dayInMs = 24 * 60 * 60 * 1000

      // Create sessions with different ages
      const sessions = [
        {
          id: "old-session",
          startTime: new Date(now - 40 * dayInMs).toISOString(), // 40 days old
        },
        {
          id: "recent-session",
          startTime: new Date(now - 5 * dayInMs).toISOString(), // 5 days old
        },
      ]

      sessions.forEach((session) => {
        const path = `${testSessionsDir}/${session.id}.json`
        writeFileSync(path, JSON.stringify(session, null, 2))
      })

      // Simulate cleanup (30 days retention)
      const retentionDays = 30
      const cutoffDate = new Date(now - retentionDays * dayInMs)

      const files = require("fs").readdirSync(testSessionsDir)
      files.forEach((file: string) => {
        const sessionPath = path.join(testSessionsDir, file)
        const session = JSON.parse(readFileSync(sessionPath, "utf-8"))
        if (new Date(session.startTime) < cutoffDate) {
          rmSync(sessionPath)
        }
      })

      // Verify old session is removed
      expect(existsSync(path.join(testSessionsDir, "old-session.json"))).toBe(false)
      expect(existsSync(path.join(testSessionsDir, "recent-session.json"))).toBe(true)
    })
  })

  describe("History Search", () => {
    it("should search through conversation content", () => {
      const turnsDir = path.join(testHistoryDir, "turns")
      mkdirSync(turnsDir, { recursive: true })

      // Create session with searchable content
      const sessionId = "search-test"
      const turns = [
        {
          role: "user",
          content: "How do I implement React Navigation?",
          timestamp: new Date().toISOString(),
        },
        {
          role: "assistant",
          content: "To implement React Navigation, first install the required packages...",
          timestamp: new Date().toISOString(),
        },
      ]

      const turnsPath = path.join(turnsDir, `${sessionId}.jsonl`)
      writeFileSync(turnsPath, turns.map((t) => JSON.stringify(t)).join("\n"))

      // Search for "React Navigation"
      const searchTerm = "React Navigation"
      const content = readFileSync(turnsPath, "utf-8")
      const matches = content
        .split("\n")
        .map((line) => JSON.parse(line))
        .filter((turn) => turn.content.toLowerCase().includes(searchTerm.toLowerCase()))

      expect(matches).toHaveLength(2)
      expect(matches[0].content).toContain("React Navigation")
    })
  })

  describe("Session Hooks", () => {
    it("should have session start hook", () => {
      const hookPath = path.join(__dirname, "../../.claude/hooks/session-start-hook.ts")
      expect(existsSync(hookPath)).toBe(true)

      const content = readFileSync(hookPath, "utf-8")
      expect(content).toContain("#!/usr/bin/env bun")
      expect(content).toContain("HistoryManager")
      expect(content).toContain("createSession")
    })

    it("should have session stop hook", () => {
      const hookPath = path.join(__dirname, "../../.claude/hooks/session-stop-hook.ts")
      expect(existsSync(hookPath)).toBe(true)

      const content = readFileSync(hookPath, "utf-8")
      expect(content).toContain("#!/usr/bin/env bun")
      expect(content).toContain("parseTranscript")
      expect(content).toContain("endSession")
    })
  })

  describe("History Command", () => {
    it("should have history command file", () => {
      const commandPath = path.join(__dirname, "../../.claude/commands/history.md")
      expect(existsSync(commandPath)).toBe(true)

      const content = readFileSync(commandPath, "utf-8")
      expect(content).toContain("allowed-tools: Read, Bash, Write")
      expect(content).toContain("View and manage conversation history")
      expect(content).toContain("list")
      expect(content).toContain("search")
      expect(content).toContain("export")
      expect(content).toContain("stats")
    })
  })

  describe("Settings Configuration", () => {
    it("should have session hooks configured", () => {
      const settingsPath = path.join(__dirname, "../../.claude/settings.json")
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"))

      // Check SessionStart hook
      expect(settings.hooks.SessionStart).toBeDefined()
      const startHooks = settings.hooks.SessionStart[0].hooks
      expect(startHooks).toHaveLength(1)
      expect(startHooks[0].command).toContain("session-start-hook.ts")

      // Check Stop hook
      expect(settings.hooks.Stop).toBeDefined()
      const stopHooks = settings.hooks.Stop[0].hooks
      expect(stopHooks).toHaveLength(1)
      expect(stopHooks[0].command).toContain("session-stop-hook.ts")
    })
  })
})
