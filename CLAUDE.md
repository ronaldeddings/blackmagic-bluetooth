# ReactNativeCE Project Memory

## Project Overview
- React Native/Expo app with Ignite boilerplate
- TypeScript enabled (strict mode)
- Runtime: Bun (no npm, use bun for all operations)
- Git Branch: main
- Testing: Jest + React Native Testing Library
- State Management: Context API (AuthContext, EpisodeContext)

## Important Directories
- `app/` - Main React Native application code
- `app/components/` - Reusable UI components
- `app/screens/` - Screen components
- `app/services/` - API and external services  
- `app/context/` - React Context providers
- `app/theme/` - Design system (colors, spacing, typography)
- `.claude/` - Claude Code configuration and automation
- `Resources/Context-Engineering-Guide/` - Development guides

## Development Guidelines
- ALWAYS use TypeScript (.ts/.tsx files)
- Follow Ignite patterns and conventions
- Use existing components before creating new ones
- Test all features on both iOS and Android
- Run bun commands, not npm
- All hooks and scripts should be TypeScript files

## Common Commands
- `bun install` - Install dependencies
- `bun run start` - Start development server
- `bun run test` - Run tests
- `bun run lint` - Run linter
- `bun run build:ios:sim` - Build for iOS simulator
- `bun run build:android:dev` - Build for Android device

## Project-Specific Memory Imports
@.claude/memory/coding-standards.md
@.claude/memory/architecture-decisions.md
@.claude/memory/team-preferences.md

## User-Specific Memory Import
@~/.claude/CLAUDE.md

## Recent Context
- Implementing Claude Code memory and history functionality
- Focus on AI-assisted development with zero coding experience users
- All code will be created by generative AI agents