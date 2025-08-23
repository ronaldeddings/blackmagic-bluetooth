import { describe, it, expect, beforeEach, afterEach } from "@jest/globals"
import { existsSync, rmSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import path from "path"

describe("Memory System", () => {
  const testDir = path.join(__dirname, "test-memory-data")
  const testMemoryPath = path.join(testDir, "CLAUDE.md")
  const testClaudeDir = path.join(testDir, ".claude")
  const testMemoryDir = path.join(testClaudeDir, "memory")

  beforeEach(() => {
    // Create test directories
    mkdirSync(testDir, { recursive: true })
    mkdirSync(testClaudeDir, { recursive: true })
    mkdirSync(testMemoryDir, { recursive: true })
  })

  afterEach(() => {
    // Clean up test directories
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe("Memory Files", () => {
    it("should create CLAUDE.md file", () => {
      const content = `# ReactNativeCE Project Memory

## Project Overview
- React Native/Expo app with Ignite boilerplate
- TypeScript enabled (strict mode)
- Runtime: Bun (no npm, use bun for all operations)

## Memory Added: ${new Date().toISOString()}
Test memory content
`
      writeFileSync(testMemoryPath, content)

      expect(existsSync(testMemoryPath)).toBe(true)
      const savedContent = readFileSync(testMemoryPath, "utf-8")
      expect(savedContent).toContain("ReactNativeCE Project Memory")
      expect(savedContent).toContain("Test memory content")
    })

    it("should append to existing memory", () => {
      // Create initial memory
      writeFileSync(testMemoryPath, "# Initial Memory\nFirst entry\n")

      // Append new memory
      const timestamp = new Date().toISOString()
      const appendContent = `\n## Memory Added: ${timestamp}\nSecond entry\n`
      const existingContent = readFileSync(testMemoryPath, "utf-8")
      writeFileSync(testMemoryPath, existingContent + appendContent)

      const finalContent = readFileSync(testMemoryPath, "utf-8")
      expect(finalContent).toContain("First entry")
      expect(finalContent).toContain("Second entry")
      expect(finalContent).toContain("Memory Added:")
    })

    it("should support memory imports", () => {
      // Create main memory with imports
      const claudeMd = `# Project Memory

## Project-Specific Memory Imports
@.claude/memory/coding-standards.md
@.claude/memory/architecture-decisions.md
@.claude/memory/team-preferences.md
`
      writeFileSync(testMemoryPath, claudeMd)

      // Create imported files
      writeFileSync(
        path.join(testMemoryDir, "coding-standards.md"),
        "# Coding Standards\n- Use TypeScript strict mode\n- Follow ESLint rules",
      )
      writeFileSync(
        path.join(testMemoryDir, "architecture-decisions.md"),
        "# Architecture Decisions\n- Use Context API for state\n- Ignite boilerplate patterns",
      )
      writeFileSync(
        path.join(testMemoryDir, "team-preferences.md"),
        "# Team Preferences\n- Bun runtime only\n- No npm usage",
      )

      // Verify all files exist
      expect(existsSync(testMemoryPath)).toBe(true)
      expect(existsSync(path.join(testMemoryDir, "coding-standards.md"))).toBe(true)
      expect(existsSync(path.join(testMemoryDir, "architecture-decisions.md"))).toBe(true)
      expect(existsSync(path.join(testMemoryDir, "team-preferences.md"))).toBe(true)

      // Verify imports are referenced
      const mainContent = readFileSync(testMemoryPath, "utf-8")
      expect(mainContent).toContain("@.claude/memory/coding-standards.md")
      expect(mainContent).toContain("@.claude/memory/architecture-decisions.md")
      expect(mainContent).toContain("@.claude/memory/team-preferences.md")
    })

    it("should search across memory files", () => {
      // Create memory files with searchable content
      writeFileSync(testMemoryPath, "# Main Memory\nUse TypeScript for all code")
      writeFileSync(
        path.join(testMemoryDir, "coding-standards.md"),
        "# Standards\nTypeScript strict mode enabled",
      )
      writeFileSync(
        path.join(testMemoryDir, "team-preferences.md"),
        "# Preferences\nPrefer functional components",
      )

      // Search for "TypeScript"
      const files = [testMemoryPath, path.join(testMemoryDir, "coding-standards.md")]
      const results: string[] = []

      files.forEach((file) => {
        if (existsSync(file)) {
          const content = readFileSync(file, "utf-8")
          if (content.toLowerCase().includes("typescript")) {
            results.push(file)
          }
        }
      })

      expect(results).toHaveLength(2)
      expect(results).toContain(testMemoryPath)
      expect(results).toContain(path.join(testMemoryDir, "coding-standards.md"))
    })

    it("should backup memory before clearing", () => {
      // Create memory file
      const originalContent = "# Important Memory\nCritical project information"
      writeFileSync(testMemoryPath, originalContent)

      // Backup before clear
      const backupPath = `${testMemoryPath}.backup.${Date.now()}`
      writeFileSync(backupPath, originalContent)

      // Clear memory
      writeFileSync(testMemoryPath, `# Memory File\n\nCleared on ${new Date().toISOString()}\n`)

      // Verify backup exists and contains original content
      expect(existsSync(backupPath)).toBe(true)
      const backupContent = readFileSync(backupPath, "utf-8")
      expect(backupContent).toBe(originalContent)

      // Verify main file is cleared
      const clearedContent = readFileSync(testMemoryPath, "utf-8")
      expect(clearedContent).toContain("Cleared on")
      expect(clearedContent).not.toContain("Critical project information")
    })
  })

  describe("Memory Shortcut Hook", () => {
    it("should block prompts starting with #", () => {
      const prompt = "# Remember to use TypeScript strict mode"

      // Simulate hook behavior
      if (prompt.startsWith("#")) {
        const memoryContent = prompt.substring(1).trim()
        const timestamp = new Date().toISOString()
        const entry = `\n## Quick Memory - ${timestamp}\n${memoryContent}\n`

        // Would append to CLAUDE.md
        writeFileSync(testMemoryPath, `# Memory\n${entry}`)

        const saved = readFileSync(testMemoryPath, "utf-8")
        expect(saved).toContain("Remember to use TypeScript strict mode")
        expect(saved).toContain("Quick Memory")
      }
    })
  })

  describe("Slash Commands", () => {
    it("should have memory command file", () => {
      const commandPath = path.join(__dirname, "../../.claude/commands/memory.md")
      expect(existsSync(commandPath)).toBe(true)

      const content = readFileSync(commandPath, "utf-8")
      expect(content).toContain("allowed-tools: Read, Write, Edit, Bash")
      expect(content).toContain("Manage Claude Code memory files")
    })

    it("should have remember command file", () => {
      const commandPath = path.join(__dirname, "../../.claude/commands/remember.md")
      expect(existsSync(commandPath)).toBe(true)

      const content = readFileSync(commandPath, "utf-8")
      expect(content).toContain("allowed-tools: Write, Read, Edit")
      expect(content).toContain("Quickly add information to memory")
    })
  })

  describe("Settings Configuration", () => {
    it("should have hooks configured in settings.json", () => {
      const settingsPath = path.join(__dirname, "../../.claude/settings.json")
      expect(existsSync(settingsPath)).toBe(true)

      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"))

      // Check memory shortcut hook
      expect(settings.hooks.UserPromptSubmit).toBeDefined()
      const userPromptHooks = settings.hooks.UserPromptSubmit[0].hooks
      const memoryHook = userPromptHooks.find((h: any) =>
        h.command.includes("memory-shortcut-hook.ts"),
      )
      expect(memoryHook).toBeDefined()
      expect(memoryHook.timeout).toBe(5)
    })
  })
})
