# Documentation Rules

## Markdown Documentation Files

### Date Tags

**ALL markdown documentation files MUST include a date tag** to track when they were created or last significantly modified.

#### Format

- **Location**: Line 3 (directly below the main title, after a blank line)
- **Format**: `📅 Nov 15, 2025`
- **Blank line**: Always include a blank line after the date tag

#### Example Structure

```markdown
# Document Title

📅 Nov 15, 2025

## Section 1
Content here...
```

#### When to Add/Update Date Tags

- ✅ **New documentation files**: Always add date tag when creating new `.md` files
- ✅ **Significant updates**: Update date tag when making substantial changes to existing docs
- ✅ **Refactoring documentation**: Update when documenting large refactors or architectural changes
- ❌ **Minor edits**: Don't update for typo fixes or small clarifications

#### Automatic Date Tag Management

The project includes an automated script to add/update date tags:

```bash
# Run from monorepo root
pnpm --filter @workspace/scripts md.date-tags
```

**The script will:**
- Use git commit date (first commit) as primary source
- Fall back to file modification date if git date unavailable
- Detect existing tags and update them in place
- Add new tags on line 3 for files without tags
- Ensure a blank line follows the tag

#### When Creating Documentation

When the AI assistant creates or modifies markdown documentation files:

1. **Check for existing date tag** (usually on line 3)
2. **If tag exists**: Update it with current date (git commit date preferred)
3. **If no tag exists**: Add new tag on line 3, after the title and a blank line
4. **Always ensure**: A blank line follows the date tag

#### Documentation File Types

This rule applies to:
- ✅ README files (`README.md`, `README.*.md`)
- ✅ TODO lists (`TODO.*.md`)
- ✅ Architecture documentation (`ARCHITECTURAL_*.md`)
- ✅ Refactoring summaries (`*_REFACTOR.md`, `*_SUMMARY.md`)
- ✅ Fix documentation (`*_FIXED.md`, `FIXES_*.md`)
- ✅ Feature documentation
- ✅ System/component documentation
- ✅ Any other `.md` files used for project documentation

**Does NOT apply to:**
- ❌ Code comments (use JSDoc instead)
- ❌ Inline documentation within code files
- ❌ Generated documentation files

## Documentation Creation Guidelines

### When to Create Documentation

Documentation should be created for:

- ✅ **Large refactors**: Significant code restructuring or architectural changes
- ✅ **Complex systems**: Business logic, architectural systems, or complex features
- ✅ **New major features**: When introducing substantial new functionality
- ✅ **User requests**: When explicitly requested by the user
- ✅ **Architectural decisions**: Important design decisions that need explanation

### When NOT to Create Documentation

- ❌ **Small changes**: Minor bug fixes or small feature additions
- ❌ **Routine updates**: Regular maintenance or small improvements
- ❌ **Self-explanatory code**: Simple, straightforward implementations

### Documentation Structure

When creating new documentation files:

1. **Title**: Clear, descriptive H1 heading
2. **Date tag**: `📅 [Date]` on line 3 (see above)
3. **Blank line**: After date tag
4. **Sections**: Use H2/H3 headings for organization
5. **Content**: Clear, concise explanations with examples when helpful

### Updating Existing Documentation

When updating existing documentation:

1. **Check date tag**: Verify it exists and is on line 3
2. **Update date tag**: If making significant changes, update the date
3. **Preserve structure**: Maintain existing organization unless improving it
4. **Add context**: Note what changed and why, if relevant

## Code Comments vs. Documentation Files

- **Code comments (JSDoc)**: For inline function/class documentation
- **Markdown files**: For higher-level explanations, architecture, refactoring notes, and system documentation

Both are important, but serve different purposes.

