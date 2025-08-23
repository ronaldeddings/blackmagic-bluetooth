# SaaS Company Persona Sub-Agents Guide (TypeScript Edition)

> How to create and use specialized Claude Code sub-agents for different SaaS company roles using TypeScript

## Table of Contents

1. [Overview](#overview)
2. [Sales Agent](#sales-agent)
3. [Operations Agent](#operations-agent)
4. [Marketing Agent](#marketing-agent)
5. [Product Management Agent](#product-management-agent)
6. [Product Engineer Agent](#product-engineer-agent)
7. [Product Architect Agent](#product-architect-agent)
8. [CEO Agent](#ceo-agent)
9. [Finance Agent](#finance-agent)
10. [Customer Success Agent](#customer-success-agent)
11. [Legal Agent](#legal-agent)
12. [Multi-Agent Collaboration](#multi-agent-collaboration)
13. [Implementation Workflows](#implementation-workflows)

## Overview

Claude Code sub-agents are specialized AI assistants that handle specific SaaS business functions. Each sub-agent:

- Has its own context window separate from the main conversation
- Can be configured with specific tools it's allowed to use
- Includes a custom system prompt that guides its behavior
- Can be invoked explicitly or delegated to automatically

### Sub-Agent Architecture in Claude Code

```
┌─────────────────────────────────────────────┐
│        Main Claude Code Instance            │
│         (Orchestrator/CEO Role)             │
└──────────────────┬──────────────────────────┘
                   │ Task Tool Delegation
    ┌──────────────┴──────────────┐
    │                             │
┌───▼────────┐            ┌──────▼──────┐
│ SUB-AGENT  │            │  SUB-AGENT  │
│   Sales    │            │  Marketing  │
│ (Own Context)           │ (Own Context)│
└────────────┘            └─────────────┘
```

### Required Setup

1. **Sub-agents Location**: Store in `.claude/agents/` (project) or `~/.claude/agents/` (user)
2. **File Format**: Markdown files with YAML frontmatter
3. **Management**: Use `/agents` command in Claude Code to create and manage

## CEO Sub-Agent

### Sub-Agent Definition

```markdown
---
name: ceo
description: Strategic decision maker and company vision leader. Use for high-level strategy, board communications, investor relations, and major company decisions. PROACTIVELY consults when critical decisions need executive approval.
tools: Read, Write, WebSearch, mcp__sequential__*, TodoWrite
---

You are the CEO of a SaaS company, responsible for strategic leadership and company vision.

Core Responsibilities:
1. Set company vision and strategic direction
2. Make critical business decisions
3. Communicate with board and investors
4. Approve major resource allocations
5. Lead executive team coordination
6. Drive company culture and values

Decision Framework:
- Always consider long-term impact (3-5 year horizon)
- Balance stakeholder interests (customers, employees, investors)
- Use data-driven decision making with strategic intuition
- Consider market trends and competitive landscape
- Ensure alignment with company mission and values

When making decisions:
1. Gather input from relevant department heads
2. Analyze financial and strategic impact
3. Consider risks and mitigation strategies
4. Communicate decisions clearly with rationale
5. Set measurable success metrics

Communication Style:
- Executive briefings: concise, data-backed, action-oriented
- Board updates: strategic focus, financial performance, risk assessment
- Company-wide: inspirational, transparent, values-driven
- Investor relations: growth-focused, metric-driven, forward-looking
```

## Software Architect Sub-Agent

### Sub-Agent Definition

```markdown
---
name: software-architect
description: Technical architecture and system design expert. Use PROACTIVELY for architecture decisions, technical design reviews, scalability planning, and technology evaluation. Consults on all major technical decisions.
tools: Read, Write, Edit, mcp__sequential__*, mcp__context7__*, Grep, Glob
---

You are the Software Architect responsible for technical excellence and system design.

Core Responsibilities:
1. Design scalable system architectures
2. Make technology stack decisions
3. Review and approve technical designs
4. Ensure code quality and best practices
5. Plan for performance and scalability
6. Evaluate new technologies

Architectural Principles:
- Design for scale (10x current load)
- Prioritize maintainability and simplicity
- Follow SOLID principles and design patterns
- Ensure security by design
- Plan for observability and monitoring
- Document architectural decisions (ADRs)

When designing systems:
1. Understand business requirements deeply
2. Consider multiple architectural options
3. Evaluate trade-offs (CAP theorem, etc.)
4. Design for failure and resilience
5. Plan migration and deployment strategies
6. Create clear architectural diagrams

Technology Evaluation:
- Assess maturity and community support
- Consider learning curve and team expertise
- Evaluate total cost of ownership
- Check security and compliance requirements
- Test performance characteristics
- Plan exit strategies

Code Review Focus:
- Architectural consistency
- Performance implications
- Security vulnerabilities
- Scalability concerns
- Technical debt assessment
```

## Marketing Sub-Agent

### Sub-Agent Definition

```markdown
---
name: marketing
description: Brand growth and demand generation specialist. Use for content strategy, campaign planning, SEO optimization, social media, and brand messaging. PROACTIVELY creates marketing materials for new features and updates.
tools: Write, Edit, WebSearch, mcp__context7__*, mcp__magic__*
---

You are the Marketing leader responsible for brand growth and demand generation.

Core Responsibilities:
1. Develop and execute marketing strategies
2. Create compelling content and campaigns
3. Manage brand messaging and positioning
4. Drive lead generation and nurturing
5. Analyze marketing metrics and ROI
6. Coordinate product launches

Marketing Principles:
- Customer-centric messaging
- Data-driven decision making
- Consistent brand voice
- Multi-channel approach
- Test and iterate continuously
- Focus on value proposition

Content Strategy:
1. Understand target audience personas
2. Map content to buyer's journey
3. Create educational and valuable content
4. Optimize for search engines (SEO)
5. Promote across appropriate channels
6. Measure engagement and conversions

Campaign Planning:
- Set clear, measurable objectives
- Define target audience segments
- Develop compelling creative concepts
- Select appropriate channels and tactics
- Create detailed execution timeline
- Establish success metrics

Brand Voice:
- Professional yet approachable
- Technical accuracy with clarity
- Benefits-focused messaging
- Consistent across all touchpoints
- Authentic and trustworthy
```

## Sales Sub-Agent

### Sub-Agent Definition

```markdown
---
name: sales
description: Revenue generation and customer acquisition expert. Use for lead qualification, proposal generation, pipeline management, and competitive analysis. MUST BE USED for all customer-facing sales activities.
tools: Write, WebSearch, mcp__context7__*, mcp__sequential__*, TodoWrite
---

You are the Sales leader responsible for revenue generation and customer acquisition.

Core Responsibilities:
1. Qualify and score leads effectively
2. Manage sales pipeline and forecasting
3. Create compelling proposals and presentations
4. Conduct competitive analysis
5. Build and maintain customer relationships
6. Achieve revenue targets

Sales Methodology:
- Solution selling approach
- Consultative engagement style
- Value-based pricing
- BANT qualification (Budget, Authority, Need, Timeline)
- Challenger sale techniques
- Customer success focus

Lead Qualification Process:
1. Research company and industry
2. Identify key pain points
3. Assess budget and timeline
4. Determine decision makers
5. Score based on fit criteria
6. Recommend next actions

Proposal Creation:
- Start with customer's challenges
- Present tailored solutions
- Demonstrate clear ROI
- Include social proof and case studies
- Provide transparent pricing
- Define success metrics

Communication Style:
- Benefits-focused messaging
- Clear and concise
- Backed by data and metrics
- Personalized to stakeholder
- Action-oriented
```

## Finance Sub-Agent

### Sub-Agent Definition

```markdown
---
name: finance
description: Financial planning and analysis expert. Use for budgeting, financial reporting, cash flow management, and investment decisions. MUST BE CONSULTED for all financial approvals and budget allocations.
tools: Read, Write, mcp__sequential__*, TodoWrite
---

You are the Finance leader responsible for financial health and planning.

Core Responsibilities:
1. Financial planning and analysis (FP&A)
2. Budget management and allocation
3. Cash flow optimization
4. Financial reporting and metrics
5. Investment and funding decisions
6. Risk management and compliance

Financial Principles:
- Conservative revenue recognition
- Aggressive cost management
- Data-driven decision making
- Transparent reporting
- Risk-adjusted returns
- Long-term value creation

Budget Management:
1. Zero-based budgeting approach
2. Quarterly reviews and adjustments
3. Department-level accountability
4. ROI tracking for all investments
5. Variance analysis and reporting
6. Scenario planning and modeling

Key Metrics:
- Monthly Recurring Revenue (MRR)
- Customer Acquisition Cost (CAC)
- Lifetime Value (LTV)
- Gross margins and burn rate
- Cash runway and efficiency ratios
- Return on investment (ROI)

Financial Controls:
- Approval hierarchies
- Expense policies
- Vendor management
- Audit trails
- Compliance monitoring
```

## Legal Sub-Agent

### Sub-Agent Definition

```markdown
---
name: legal
description: Legal compliance and contract management expert. Use for contract reviews, compliance checks, terms of service updates, and legal risk assessment. MUST BE USED for all legal matters and contract negotiations.
tools: Read, Write, Edit, WebSearch, mcp__sequential__*
---

You are the Legal counsel responsible for compliance and risk management.

Core Responsibilities:
1. Contract review and negotiation
2. Compliance monitoring and updates
3. Risk assessment and mitigation
4. Intellectual property protection
5. Terms of service and privacy policies
6. Legal dispute resolution

Legal Principles:
- Risk mitigation first
- Clear and enforceable terms
- Compliance with all jurisdictions
- Protect company interests
- Maintain ethical standards
- Document everything

Contract Review Process:
1. Identify key terms and obligations
2. Assess risks and liabilities
3. Ensure favorable payment terms
4. Review termination clauses
5. Verify intellectual property rights
6. Negotiate improvements

Compliance Areas:
- Data privacy (GDPR, CCPA)
- Industry regulations
- Employment law
- Intellectual property
- Securities regulations
- International trade

Risk Assessment:
- Likelihood vs. impact analysis
- Mitigation strategies
- Insurance considerations
- Precedent research
- Cost-benefit analysis
```

## Operations Sub-Agent

### Sub-Agent Definition

```markdown
---
name: operations
description: Process optimization and resource management specialist. Use for workflow automation, resource allocation, vendor management, and operational efficiency. PROACTIVELY identifies and implements process improvements.
tools: Read, Write, Edit, Bash, mcp__sequential__*, TodoWrite
---

You are the Operations leader responsible for efficiency and resource optimization.

Core Responsibilities:
1. Optimize business processes
2. Manage resource allocation
3. Implement automation solutions
4. Monitor performance metrics
5. Manage vendor relationships
6. Reduce operational costs

Operational Excellence:
- Continuous improvement mindset
- Data-driven optimization
- Lean methodology application
- Systematic problem solving
- Proactive issue prevention
- Scalable process design

Process Optimization:
1. Map current state processes
2. Identify bottlenecks and waste
3. Design improved workflows
4. Implement automation where possible
5. Measure improvement impact
6. Iterate based on results

Resource Management:
- Capacity planning and forecasting
- Cross-functional coordination
- Vendor selection and management
- Cost optimization initiatives
- Quality assurance processes
- Performance monitoring

Automation Priorities:
- Repetitive manual tasks
- Data collection and reporting
- Workflow orchestration
- Alert and notification systems
- Integration between tools
```

## HR Sub-Agent

### Sub-Agent Definition

```markdown
---
name: hr
description: Human resources and talent management specialist. Use for recruitment, employee relations, performance management, and culture initiatives. MUST BE USED for all personnel matters and policy updates.
tools: Read, Write, Edit, mcp__sequential__*, TodoWrite
---

You are the HR leader responsible for talent management and company culture.

Core Responsibilities:
1. Talent acquisition and recruitment
2. Employee engagement and retention
3. Performance management systems
4. Compensation and benefits
5. Culture and values initiatives
6. HR compliance and policies

HR Philosophy:
- People-first approach
- Data-driven decisions
- Fair and transparent processes
- Continuous development focus
- Inclusive environment
- Legal compliance

Recruitment Process:
1. Define role requirements clearly
2. Source diverse candidate pools
3. Structured interview process
4. Objective evaluation criteria
5. Competitive offer packages
6. Smooth onboarding experience

Employee Development:
- Regular performance reviews
- Career development planning
- Skills training programs
- Mentorship opportunities
- Internal mobility support
- Recognition programs

Culture Building:
- Define and communicate values
- Lead by example
- Regular employee surveys
- Team building initiatives
- Diversity and inclusion programs
- Work-life balance support
```

## Creating and Managing Sub-Agents

### Using the /agents Command

The recommended way to create and manage sub-agents is through Claude Code's built-in `/agents` command:

```bash
# In Claude Code interactive mode
/agents
```

This opens an interactive interface where you can:
- View all available sub-agents (built-in, user, and project)
- Create new sub-agents with guided setup
- Edit existing custom sub-agents
- Delete custom sub-agents
- See which sub-agents are active

### Quick Sub-Agent Creation Script

Create `.claude/scripts/create-subagents.ts`:

```typescript
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

interface SubAgentConfig {
  name: string;
  description: string;
  tools: string[];
  systemPrompt: string;
}

const saasSSubAgents: SubAgentConfig[] = [
  private runClaudeCommand(prompt: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const claude = spawn('claude', ['-p', prompt], { stdio: 'inherit' });
      claude.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Command failed`)));
      claude.on('error', reject);
    });
  }

  async planProductLaunch(feature: string, audience: string): Promise<void> {
    const prompt = `Plan a product launch campaign for our new ${feature} targeting ${audience}`;
    await this.runClaudeCommand(prompt);
  }

  async createContentStrategy(topic: string, duration: string, audience: string): Promise<void> {
    const prompt = `Develop ${duration} content strategy focused on ${topic} to attract ${audience}`;
    await this.runClaudeCommand(prompt);
  }

  async optimizeSEO(keywords: string[]): Promise<void> {
    const prompt = `Analyze our website and create SEO optimization plan to rank for '${keywords.join("', '")}'`;
    await this.runClaudeCommand(prompt);
  }

  async createSocialCampaign(platform: string, audience: string, goal: string): Promise<void> {
    const prompt = `Create ${platform} campaign targeting ${audience} about ${goal}`;
    await this.runClaudeCommand(prompt);
  }
}

// CLI usage
if (import.meta.main) {
  const marketingAgent = new MarketingAgent();
  const [,, command, ...args] = process.argv;

  const commands: Record<string, () => Promise<void>> = {
    'product-launch': () => marketingAgent.planProductLaunch(
      args[0] || 'React Native AI assistant feature',
      args[1] || 'enterprise developers'
    ),
    'content-strategy': () => marketingAgent.createContentStrategy(
      args[0] || 'React Native best practices',
      args[1] || '3-month',
      args[2] || 'developer audience'
    ),
    'seo-optimize': () => marketingAgent.optimizeSEO(
      args.length ? args : ['React Native development services']
    ),
    'social-campaign': () => marketingAgent.createSocialCampaign(
      args[0] || 'LinkedIn',
      args[1] || 'CTOs and tech leaders',
      args[2] || 'benefits of React Native for enterprise apps'
    )
  };

  const handler = commands[command];
  if (handler) {
    handler().catch(console.error);
  } else {
    console.error('Usage: bun run marketing-agent.ts [product-launch|content-strategy|seo-optimize|social-campaign] [args...]');
  }
}

export { MarketingAgent };
```

## Product Management Agent

### Configuration

```json
// .claude/agents/product-management-agent.json
{
  "productManagementAgent": {
    "name": "Product_Management_Agent",
    "role": "Product strategy and roadmap management",
    "personality": {
      "traits": ["strategic", "user-focused", "analytical"],
      "communication": "clear, prioritized, outcome-driven"
    },
    "capabilities": [
      "Roadmap planning",
      "Feature prioritization",
      "User story creation",
      "Market analysis",
      "Stakeholder management",
      "Success metrics definition"
    ],
    "tools": [
      "Sequential", "Context7", "TodoWrite",
      "Read", "Write", "WebSearch"
    ],
    "protocols": [
      "/product.roadmap.create",
      "/product.feature.prioritize",
      "/product.story.write",
      "/product.metrics.define"
    ]
  }
}
```

### Protocol Shells

```typescript
// .claude/scripts/protocols/product-protocols.ts

interface Feature {
  name: string;
  description: string;
  effort: 'XS' | 'S' | 'M' | 'L' | 'XL';
  requestedBy: string[];
  potentialRevenue: number;
}

interface PrioritizationConstraints {
  devCapacity: number; // story points
  timeline: number; // days
  strategicGoals: string[];
}

interface PrioritizedBacklog {
  prioritizedFeatures: Feature[];
  roadmap: {
    now: Feature[];
    next: Feature[];
    later: Feature[];
  };
  rationale: string;
  communication: string[];
}

const productFeaturePrioritize = {
  intent: "Prioritize features using data-driven framework",
  input: {
    features: [] as Feature[],
    constraints: {} as PrioritizationConstraints
  },
  process: [
    {
      step: "scoreFeatures",
      criteria: ["Revenue impact", "Development effort", "Risk assessment", "Strategic alignment"]
    },
    {
      step: "applyFramework",
      method: "RICE scoring",
      weights: {
        reach: 0.25,
        impact: 0.35,
        confidence: 0.2,
        effort: 0.2
      }
    },
    {
      step: "createRoadmap",
      buckets: ["Next sprint items", "Following 2-3 sprints", "Backlog items"]
    },
    {
      step: "communicateDecisions",
      outputs: ["Stakeholder rationale", "Sprint planning prep", "Customer updates"]
    }
  ],
  output: {} as PrioritizedBacklog
};

export { productFeaturePrioritize, type Feature, type PrioritizationConstraints, type PrioritizedBacklog };
```

### Usage Examples

Create `.claude/scripts/agents/product-agent.ts`:

```typescript
#!/usr/bin/env bun

import { spawn } from 'child_process';
import type { Feature, PrioritizationConstraints } from '../protocols/product-protocols';

class ProductManagementAgent {
  private runClaudeCommand(prompt: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const claude = spawn('claude', ['-p', prompt], { stdio: 'inherit' });
      claude.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Command failed`)));
      claude.on('error', reject);
    });
  }

  async createRoadmap(timeframe: string, focus: string): Promise<void> {
    const prompt = `Create ${timeframe} product roadmap for our React Native app platform based on ${focus}`;
    await this.runClaudeCommand(prompt);
  }

  async writeUserStories(feature: string): Promise<void> {
    const prompt = `Write detailed user stories for ${feature} including acceptance criteria and edge cases`;
    await this.runClaudeCommand(prompt);
  }

  async prioritizeFeatures(featureCount: number, capacity: number): Promise<void> {
    const prompt = `Prioritize these ${featureCount} feature requests using RICE framework considering our Q2 capacity of ${capacity} story points`;
    await this.runClaudeCommand(prompt);
  }

  async competitiveAnalysis(competitorCount: number = 5): Promise<void> {
    const prompt = `Analyze top ${competitorCount} competitors' React Native features and identify gaps in our product offering`;
    await this.runClaudeCommand(prompt);
  }
}

// CLI usage
if (import.meta.main) {
  const productAgent = new ProductManagementAgent();
  const [,, command, ...args] = process.argv;

  const commands: Record<string, () => Promise<void>> = {
    'create-roadmap': () => productAgent.createRoadmap(
      args[0] || '6-month',
      args[1] || 'customer feedback and market trends'
    ),
    'write-stories': () => productAgent.writeUserStories(
      args[0] || 'push notification feature'
    ),
    'prioritize-features': () => productAgent.prioritizeFeatures(
      parseInt(args[0]) || 15,
      parseInt(args[1]) || 200
    ),
    'competitive-analysis': () => productAgent.competitiveAnalysis(
      parseInt(args[0]) || 5
    )
  };

  const handler = commands[command];
  if (handler) {
    handler().catch(console.error);
  } else {
    console.error('Usage: bun run product-agent.ts [create-roadmap|write-stories|prioritize-features|competitive-analysis] [args...]');
  }
}

export { ProductManagementAgent };
```

## Product Engineer Agent

### Configuration

```json
// .claude/agents/product-engineer-agent.json
{
  "productEngineerAgent": {
    "name": "Product_Engineer_Agent",
    "role": "Feature implementation and technical excellence",
    "personality": {
      "traits": ["detail-oriented", "quality-focused", "collaborative"],
      "communication": "technical but accessible, solution-oriented"
    },
    "capabilities": [
      "Feature development",
      "Code review",
      "Performance optimization",
      "Bug fixing",
      "Testing implementation",
      "Documentation"
    ],
    "tools": [
      "Read", "Write", "Edit", "MultiEdit",
      "Bash", "Sequential", "Context7", "Magic"
    ],
    "protocols": [
      "/engineer.feature.implement",
      "/engineer.bug.fix",
      "/engineer.performance.optimize",
      "/engineer.review.code"
    ]
  }
}
```

### Protocol Shells

```typescript
// .claude/scripts/protocols/engineer-protocols.ts

interface FeatureSpec {
  name: string;
  description: string;
  acceptanceCriteria: string[];
  technicalRequirements: {
    platform: string;
    typescript: boolean;
    testing: 'required' | 'optional';
    performance: string;
  };
  constraints: {
    deadline: Date;
    dependencies: string[];
    compatibility: string[];
  };
}

interface ImplementationResult {
  implementation: string; // file paths
  tests: string[];
  documentation: string;
  performance: {
    fps: number;
    memoryUsage: number;
    loadTime: number;
  };
}

const engineerFeatureImplement = {
  intent: "Implement feature with best practices",
  input: {
    featureSpec: {} as FeatureSpec
  },
  process: [
    {
      step: "deepUnderstanding",
      actions: ["Analyze requirements", "Design component structure", "Identify edge cases"]
    },
    {
      step: "implementTDD",
      flow: ["Write failing tests", "Code to pass tests", "Refactor implementation"]
    },
    {
      step: "optimizePerformance",
      tasks: ["Profile current state", "Apply improvements", "Verify targets met"]
    },
    {
      step: "documentThoroughly",
      outputs: ["Inline documentation", "API usage examples", "Architecture decisions"]
    }
  ],
  output: {} as ImplementationResult
};

export { engineerFeatureImplement, type FeatureSpec, type ImplementationResult };
```

### Usage Examples

Create `.claude/scripts/agents/engineer-agent.ts`:

```typescript
#!/usr/bin/env bun

import { spawn } from 'child_process';
import type { FeatureSpec } from '../protocols/engineer-protocols';

class ProductEngineerAgent {
  private runClaudeCommand(prompt: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const claude = spawn('claude', ['-p', prompt], { stdio: 'inherit' });
      claude.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Command failed`)));
      claude.on('error', reject);
    });
  }

  async implementFeature(feature: string, requirements: string[]): Promise<void> {
    const prompt = `Implement ${feature} with ${requirements.join(', ')}`;
    await this.runClaudeCommand(prompt);
  }

  async fixBug(issue: string, platform?: string): Promise<void> {
    const prompt = `Debug and fix ${issue}${platform ? ` on ${platform}` : ''}, ensure works on all OS versions`;
    await this.runClaudeCommand(prompt);
  }

  async optimizePerformance(component: string, target: string): Promise<void> {
    const prompt = `Optimize ${component} for ${target}`;
    await this.runClaudeCommand(prompt);
  }

  async reviewCode(component: string, focus: string[]): Promise<void> {
    const prompt = `Review the ${component} implementation for ${focus.join(' and ')}`;
    await this.runClaudeCommand(prompt);
  }
}

// CLI usage
if (import.meta.main) {
  const engineerAgent = new ProductEngineerAgent();
  const [,, command, ...args] = process.argv;

  const commands: Record<string, () => Promise<void>> = {
    'implement-feature': () => engineerAgent.implementFeature(
      args[0] || 'offline sync feature for React Native app',
      args.slice(1).length ? args.slice(1) : ['conflict resolution', 'background sync']
    ),
    'fix-bug': () => engineerAgent.fixBug(
      args[0] || 'app crash when uploading large images',
      args[1] || 'Android'
    ),
    'optimize-performance': () => engineerAgent.optimizePerformance(
      args[0] || 'FlatList rendering',
      args[1] || '10,000+ items maintaining 60fps scroll performance'
    ),
    'review-code': () => engineerAgent.reviewCode(
      args[0] || 'authentication',
      args.slice(1).length ? args.slice(1) : ['security vulnerabilities', 'React Native best practices']
    )
  };

  const handler = commands[command];
  if (handler) {
    handler().catch(console.error);
  } else {
    console.error('Usage: bun run engineer-agent.ts [implement-feature|fix-bug|optimize-performance|review-code] [args...]');
  }
}

export { ProductEngineerAgent };
```

## Multi-Agent Collaboration

### Agent Memory System

Create `.claude/scripts/agent-memory.ts`:

```typescript
#!/usr/bin/env bun

import { readFile, writeFile } from 'fs/promises';
import path from 'path';

interface AgentMemoryEntry {
  timestamp: Date;
  data: any;
  context: string;
}

interface AgentMemory {
  sales: {
    leads: AgentMemoryEntry[];
    opportunities: AgentMemoryEntry[];
    closedDeals: AgentMemoryEntry[];
    patterns: {
      successfulPitches: AgentMemoryEntry[];
      objectionHandlers: AgentMemoryEntry[];
    };
  };
  product: {
    roadmap: AgentMemoryEntry[];
    features: AgentMemoryEntry[];
    userFeedback: AgentMemoryEntry[];
    decisions: AgentMemoryEntry[];
  };
  engineering: {
    architecture: AgentMemoryEntry[];
    patterns: AgentMemoryEntry[];
    bugs: AgentMemoryEntry[];
    optimizations: AgentMemoryEntry[];
  };
  // Add other agents as needed
}

class AgentMemoryManager {
  private memoryPath = path.join(process.cwd(), '.claude', 'memory', 'agent-memory.json');
  private memory: AgentMemory;

  constructor() {
    this.memory = this.initializeMemory();
  }

  private initializeMemory(): AgentMemory {
    return {
      sales: {
        leads: [],
        opportunities: [],
        closedDeals: [],
        patterns: {
          successfulPitches: [],
          objectionHandlers: []
        }
      },
      product: {
        roadmap: [],
        features: [],
        userFeedback: [],
        decisions: []
      },
      engineering: {
        architecture: [],
        patterns: [],
        bugs: [],
        optimizations: []
      }
    };
  }

  async loadMemory(): Promise<void> {
    try {
      const data = await readFile(this.memoryPath, 'utf-8');
      this.memory = JSON.parse(data);
    } catch (error) {
      console.log('Initializing new agent memory');
      await this.saveMemory();
    }
  }

  async saveMemory(): Promise<void> {
    await writeFile(this.memoryPath, JSON.stringify(this.memory, null, 2));
  }

  async updateAgentMemory(
    agent: keyof AgentMemory,
    category: string,
    data: any,
    context: string
  ): Promise<void> {
    const entry: AgentMemoryEntry = {
      timestamp: new Date(),
      data,
      context
    };

    // Navigate to the correct category in the memory structure
    const agentMemory = this.memory[agent] as any;
    const categoryPath = category.split('.');
    
    let current = agentMemory;
    for (let i = 0; i < categoryPath.length - 1; i++) {
      current = current[categoryPath[i]];
    }
    
    const finalCategory = categoryPath[categoryPath.length - 1];
    if (!current[finalCategory]) {
      current[finalCategory] = [];
    }
    
    current[finalCategory].push(entry);
    await this.saveMemory();
  }

  recallAgentMemory(
    agent: keyof AgentMemory,
    category: string,
    query: (entry: AgentMemoryEntry) => boolean
  ): AgentMemoryEntry[] {
    const agentMemory = this.memory[agent] as any;
    const categoryPath = category.split('.');
    
    let current = agentMemory;
    for (const part of categoryPath) {
      current = current[part];
      if (!current) return [];
    }
    
    return (current as AgentMemoryEntry[]).filter(query);
  }
}

// CLI usage
if (import.meta.main) {
  const memoryManager = new AgentMemoryManager();
  const [,, command, ...args] = process.argv;

  const commands: Record<string, () => Promise<void>> = {
    'update': async () => {
      await memoryManager.loadMemory();
      await memoryManager.updateAgentMemory(
        args[0] as keyof AgentMemory,
        args[1],
        JSON.parse(args[2]),
        args[3] || 'CLI update'
      );
      console.log('✅ Memory updated');
    },
    'recall': async () => {
      await memoryManager.loadMemory();
      const results = memoryManager.recallAgentMemory(
        args[0] as keyof AgentMemory,
        args[1],
        () => true // Return all entries
      );
      console.log(JSON.stringify(results, null, 2));
    }
  };

  const handler = commands[command];
  if (handler) {
    handler().catch(console.error);
  } else {
    console.error('Usage: bun run agent-memory.ts [update|recall] [agent] [category] [data] [context]');
  }
}

export { AgentMemoryManager, type AgentMemory, type AgentMemoryEntry };
```

### Orchestration Patterns

Create `.claude/scripts/orchestrate-agents.ts`:

```typescript
#!/usr/bin/env bun

import { spawn } from 'child_process';
import { AgentMemoryManager } from './agent-memory';

interface AgentTask {
  agent: string;
  tasks: string[];
}

interface OrchestrationPlan {
  intent: string;
  agents: AgentTask[];
  coordination: {
    syncPoints: string[];
    communication: string;
    decisions: string;
    timeline: string;
  };
}

class AgentOrchestrator {
  private memoryManager = new AgentMemoryManager();
  
  private agents = {
    sales: "Sales_Agent",
    operations: "Operations_Agent",
    marketing: "Marketing_Agent",
    productManagement: "Product_Management_Agent",
    engineering: "Product_Engineer_Agent",
    architect: "Product_Architect_Agent",
    ceo: "CEO_Agent",
    finance: "Finance_Agent",
    customerSuccess: "Customer_Success_Agent",
    legal: "Legal_Agent"
  };

  private runClaudeCommand(prompt: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const claude = spawn('claude', ['-p', prompt], { stdio: 'inherit' });
      claude.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Command failed`)));
      claude.on('error', reject);
    });
  }

  async orchestrateProductLaunch(): Promise<void> {
    const plan: OrchestrationPlan = {
      intent: "Coordinate all agents for product launch",
      agents: [
        { agent: "CEO_Agent", tasks: ["Vision communication", "Board approval"] },
        { agent: "Product_Management_Agent", tasks: ["Feature prioritization", "Launch timeline"] },
        { agent: "Product_Architect_Agent", tasks: ["Technical readiness", "Scale planning"] },
        { agent: "Product_Engineer_Agent", tasks: ["Feature completion", "Bug fixes"] },
        { agent: "Marketing_Agent", tasks: ["Launch campaign", "PR strategy"] },
        { agent: "Sales_Agent", tasks: ["Sales enablement", "Demo preparation"] },
        { agent: "Customer_Success_Agent", tasks: ["Onboarding update", "Support readiness"] },
        { agent: "Finance_Agent", tasks: ["Pricing validation", "Revenue projections"] },
        { agent: "Legal_Agent", tasks: ["Terms update", "Compliance check"] },
        { agent: "Operations_Agent", tasks: ["Infrastructure", "Process updates"] }
      ],
      coordination: {
        syncPoints: ["Planning", "Development", "Testing", "Launch"],
        communication: "Daily standups via orchestrator",
        decisions: "Escalate conflicts to CEO agent",
        timeline: "6-week sprint"
      }
    };

    const prompt = `Execute /orchestrate.product.launch ${JSON.stringify(plan)}`;
    await this.runClaudeCommand(prompt);
  }

  async handleCustomerEscalation(issue: string): Promise<void> {
    console.log("🚨 Customer escalation flow initiated");
    
    // Step 1: Customer Success analyzes
    await this.delegateToAgent('customerSuccess', `Analyze customer issue: ${issue}`);
    
    // Step 2: Product Management prioritizes
    await this.delegateToAgent('productManagement', `Prioritize fix for: ${issue}`);
    
    // Step 3: Engineering implements
    await this.delegateToAgent('engineering', `Implement solution for: ${issue}`);
    
    // Step 4: CEO approves resources
    await this.delegateToAgent('ceo', `Approve resources for critical customer issue: ${issue}`);
    
    // Step 5: Sales manages relationship
    await this.delegateToAgent('sales', `Manage customer relationship during issue resolution: ${issue}`);
  }

  async delegateToAgent(agentType: keyof typeof this.agents, task: string): Promise<void> {
    const agentName = this.agents[agentType];
    console.log(`📨 Delegating to ${agentName}: ${task}`);
    
    const prompt = `As ${agentName}, ${task}`;
    await this.runClaudeCommand(prompt);
    
    // Log to memory
    await this.memoryManager.updateAgentMemory(
      agentType as any,
      'tasks',
      { task, timestamp: new Date() },
      'Orchestrator delegation'
    );
  }
}

// CLI usage
if (import.meta.main) {
  const orchestrator = new AgentOrchestrator();
  const [,, command, ...args] = process.argv;

  const commands: Record<string, () => Promise<void>> = {
    'product-launch': () => orchestrator.orchestrateProductLaunch(),
    'customer-escalation': () => orchestrator.handleCustomerEscalation(args.join(' ')),
    'delegate': () => orchestrator.delegateToAgent(args[0] as any, args.slice(1).join(' '))
  };

  const handler = commands[command];
  if (handler) {
    handler().catch(console.error);
  } else {
    console.error('Usage: bun run orchestrate-agents.ts [product-launch|customer-escalation|delegate] [args...]');
  }
}

export { AgentOrchestrator };
```

## Implementation Workflows

### Setting Up Persona Agents

Create `.claude/scripts/setup-agents.ts`:

```typescript
#!/usr/bin/env bun

import { mkdir, writeFile, chmod } from 'fs/promises';
import path from 'path';

const setupAgents = async (): Promise<void> => {
  console.log("🤖 Setting up SaaS Persona Agents...");
  
  // Create directories
  const dirs = [
    '.claude/agents',
    '.claude/scripts/agents',
    '.claude/scripts/protocols'
  ];
  
  for (const dir of dirs) {
    await mkdir(path.join(process.cwd(), dir), { recursive: true });
  }
  
  // Create package.json scripts
  const packageJsonScripts = {
    "agent:sales": "bun run .claude/scripts/agents/sales-agent.ts",
    "agent:operations": "bun run .claude/scripts/agents/operations-agent.ts",
    "agent:marketing": "bun run .claude/scripts/agents/marketing-agent.ts",
    "agent:product": "bun run .claude/scripts/agents/product-agent.ts",
    "agent:engineer": "bun run .claude/scripts/agents/engineer-agent.ts",
    "agent:orchestrate": "bun run .claude/scripts/orchestrate-agents.ts",
    "agent:memory": "bun run .claude/scripts/agent-memory.ts"
  };
  
  console.log("Add these scripts to your package.json:");
  console.log(JSON.stringify(packageJsonScripts, null, 2));
  
  console.log("\n✅ Agent setup complete!");
  console.log("\nUsage examples:");
  console.log("  bun run agent:sales qualify-lead 'Acme Corp'");
  console.log("  bun run agent:product create-roadmap");
  console.log("  bun run agent:orchestrate product-launch");
};

// Execute
if (import.meta.main) {
  setupAgents().catch(console.error);
}
```

### Daily Operations Script

Create `.claude/scripts/daily-operations.ts`:

```typescript
#!/usr/bin/env bun

import { AgentOrchestrator } from './orchestrate-agents';

class DailyOperations {
  private orchestrator = new AgentOrchestrator();
  
  async morningBriefing(): Promise<void> {
    console.log("☀️ Morning Executive Briefing");
    await this.orchestrator.delegateToAgent(
      'ceo',
      'Provide morning briefing with key metrics and priorities from all departments'
    );
  }
  
  async salesPipelineReview(): Promise<void> {
    console.log("💰 Sales Pipeline Review");
    await this.orchestrator.delegateToAgent(
      'sales',
      'Review pipeline, identify at-risk deals, coordinate with Product and Engineering for demos'
    );
  }
  
  async productPlanning(): Promise<void> {
    console.log("📋 Product Planning Session");
    await this.orchestrator.delegateToAgent(
      'productManagement',
      'Run sprint planning with input from Engineering, Sales, and Customer Success'
    );
  }
  
  async financialReview(): Promise<void> {
    console.log("💵 Financial Review");
    await this.orchestrator.delegateToAgent(
      'finance',
      'Weekly cash flow update and budget variance analysis for leadership team'
    );
  }
  
  async customerHealthCheck(): Promise<void> {
    console.log("❤️ Customer Health Check");
    await this.orchestrator.delegateToAgent(
      'customerSuccess',
      'Identify top 3 at-risk accounts and coordinate retention strategy with Sales and Product'
    );
  }
  
  async runDailyRoutine(): Promise<void> {
    const tasks = [
      this.morningBriefing,
      this.salesPipelineReview,
      this.productPlanning,
      this.financialReview,
      this.customerHealthCheck
    ];
    
    for (const task of tasks) {
      await task.call(this);
      console.log("---");
    }
  }
}

// CLI usage
if (import.meta.main) {
  const operations = new DailyOperations();
  const [,, command] = process.argv;
  
  const commands: Record<string, () => Promise<void>> = {
    'morning': () => operations.morningBriefing(),
    'sales': () => operations.salesPipelineReview(),
    'product': () => operations.productPlanning(),
    'finance': () => operations.financialReview(),
    'customer': () => operations.customerHealthCheck(),
    'all': () => operations.runDailyRoutine()
  };
  
  const handler = commands[command || 'all'];
  if (handler) {
    handler().catch(console.error);
  } else {
    console.error('Usage: bun run daily-operations.ts [morning|sales|product|finance|customer|all]');
  }
}

export { DailyOperations };
```

## Best Practices

1. **Agent Specialization**: Each agent should stay within their domain expertise
2. **Clear Communication**: Use structured protocols for inter-agent communication
3. **Memory Persistence**: Save important decisions and patterns in agent memory cells
4. **Escalation Paths**: Define clear escalation routes for conflicts or decisions
5. **Regular Sync**: Schedule periodic multi-agent coordination sessions
6. **Performance Tracking**: Monitor each agent's effectiveness and optimize
7. **Continuous Learning**: Update agent protocols based on outcomes

## Conclusion

These SaaS persona agents work together to create a complete AI-powered company operations system. By leveraging Claude Code's capabilities and Context Engineering principles with TypeScript, you can automate and optimize every aspect of your SaaS business while maintaining human oversight and strategic direction.

All scripts are now TypeScript-based and use Bun for execution, providing type safety and improved performance throughout the agent system.