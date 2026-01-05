# Cursor Rules File Structure

## Overview

This project uses a two-tier system for Cursor AI Assistant rules:

1. **`.cursorrules`** - Root level, global rules for the workspace
2. **`.cursor/rules/`** - Project-specific rule files, organized by topic

## File Organization

### `.cursorrules` (Root File)
**Location**: `/Users/justin/repos-finografic/touch-monorepo/.cursorrules`

**Purpose**: Global workspace guidelines that apply to ALL projects and ALL interactions

**Content Categories**:
- Server management policies
- Development workflow principles
- High-level project structure guidelines
- Meta-instructions for how the AI should approach tasks

**Example Rules**:
```
- DO NOT start development servers
- Always test APIs with curl before making changes
- Use TypeScript throughout
- Follow existing patterns and conventions
```

**When to Add Rules Here**:
- ✅ Applies to the entire workspace/monorepo
- ✅ Fundamental principles (DO/DON'T policies)
- ✅ Infrastructure or process rules
- ✅ Server/deployment guidelines
- ❌ Specific code patterns (use `.cursor/rules/` instead)
- ❌ Tool-specific configurations
- ❌ Project-specific details

---

### `.cursor/rules/` (Folder with Numbered Files)
**Location**: `/Users/justin/repos-finografic/touch-monorepo/.cursor/rules/`

**Purpose**: Detailed, project-specific coding standards and patterns

**Organization Pattern**:
- Files are numbered with a prefix (00-, 01-, 02-, etc.)
- Prefix indicates category/priority
- Topics ordered logically

**Current Files**:
- `00-general.md` - General coding principles
- `01-monorepo.md` - Monorepo-specific structure
- `02-react-patterns.md` - React component patterns
- `03-styling-system.md` - CSS/styling conventions
- `04-server-management.md` - Backend patterns
- `05-i18n-system.md` - Internationalization rules
- `06-file-naming.md` - File/folder naming conventions
- `07-typescript-patterns.md` - TypeScript best practices
- `08-testing-patterns.md` - Testing conventions
- `09-provider-context-patterns.md` - Context/provider patterns
- `10-eslint-code-style.md` - **NEW** ESLint configuration rules
- `90-project-architecture.md` - High-level architecture (numbered high for reference)

**When to Add Rules Here**:
- ✅ Specific to this project's codebase
- ✅ Code style and patterns
- ✅ Tool configurations (ESLint, Prettier, etc.)
- ✅ Component architecture decisions
- ✅ Directory structure guidelines
- ✅ Domain-specific patterns (e.g., form handling)
- ❌ Workspace-wide policies (use `.cursorrules`)

---

## Decision Matrix: Where Does a Rule Go?

| Rule Type | `.cursorrules` | `.cursor/rules/` | Example |
|-----------|---|---|---|
| **Process/Workflow** | ✅ | ❌ | "Don't start dev servers" |
| **Code Patterns** | ❌ | ✅ | "Use named parameters" |
| **Tool Config** | ❌ | ✅ | "ESLint import sorting" |
| **Infrastructure** | ✅ | ❌ | "Server runs on port 4040" |
| **Naming Conventions** | ❌ | ✅ | "Component file naming" |
| **Fundamental Principles** | ✅ | ❌ | "Use TypeScript" |
| **Project-Specific Quirks** | ❌ | ✅ | "Emotion CSS + Tailwind combo" |
| **API/Endpoint Rules** | ✅ | ❌ | "Always test with curl" |

---

## File Naming Convention

### Root File
- **Single file**: `.cursorrules` (no extension, hidden dotfile)

### Rule Folder Files
- **Naming**: `NN-topic-name.md` where NN is a two-digit number
- **Pattern**: Numbers indicate category/order
  - `00-09`: Foundational rules
  - `10-29`: Language/framework specific
  - `30-59`: Feature-specific patterns
  - `60-89`: Advanced topics
  - `90-99`: Reference/architecture

### Subdirectories in `.cursor/`
- **`rules/`** - The main rules folder
- **`chats/`** - Archived conversation summaries (auto-generated, don't edit)

---

## Content Guidelines

### Rule File Structure
Each rule file should have:

1. **Main heading**: `# Topic Area`
2. **Sections**: Subsections for related rules
3. **Examples**: Both ✅ correct and ❌ incorrect patterns
4. **Code blocks**: With language syntax highlighting
5. **Guidelines**: When/why to apply the rule

### Example Template
```markdown
# Feature Area

## Rule Category

### Specific Pattern

- **DO** this when...
- **DON'T** this because...

\`\`\`typescript
// ✅ Correct
const example = () => { }

// ❌ Avoid
const example = () => { }
\`\`\`

### Benefits
- Reason 1
- Reason 2
```

---

## How the AI Uses These Rules

1. **Reads `.cursorrules`** first - understands workspace constraints
2. **Reads `.cursor/rules/` files** - applies project-specific patterns
3. **Orders by filename** - respects the numbered organization
4. **Applies contextually** - uses relevant rules for the current task

When you ask me to:
- ✅ "Create a new component" → I check `02-react-patterns.md`
- ✅ "Fix the build" → I check `.cursorrules` for process rules
- ✅ "Sort imports" → I check `10-eslint-code-style.md`

---

## Maintenance Tips

1. **Keep `.cursorrules` lean** - Only fundamental policies
2. **Update `.cursor/rules/` frequently** - Add patterns as you discover them
3. **Link related rules** - Cross-reference rules in different files
4. **Number new files** - Follow the NN- prefix convention
5. **Archive old chat summaries** - Clean up `.cursor/chats/` periodically

---

## Recent Additions

**`10-eslint-code-style.md`** (NEW)
- Import sorting rules for `simple-import-sort`
- How to fix import order conflicts
- JSX parentheses handling with Prettier
- ESLint command reference

This rule was added to standardize:
- Import grouping across the project
- How to handle ESLint auto-fix
- Conflict resolution between linters and formatters

