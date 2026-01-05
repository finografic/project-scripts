# File Naming & Organization Rules

## File Naming Conventions

- Use kebab-case for file names: `user-profile.component.tsx`
- Use PascalCase for React components: `UserProfile.tsx`
- Use camelCase for utility files: `apiUtils.ts`
- Use descriptive names that indicate file purpose

## File Extensions

- `.tsx` for React components
- `.ts` for TypeScript utilities and types
- `.types.ts` for type-only files
- `.styles.ts` for Emotion CSS-in-JS styles
- `.constants.ts` for constant definitions
- `.utils.ts` for utility functions

## Directory Structure

```
components/
  ComponentName/
    ComponentName.tsx          # Main component
    ComponentName.types.ts     # Type definitions
    ComponentName.styles.ts    # Styles
    ComponentName.test.tsx     # Tests
    index.ts                   # Re-exports
```

## Import/Export Patterns

- Use named exports over default exports
- Create index.ts files to simplify imports
- Group related exports in index files
- Use barrel exports for cleaner import paths

## Generated Files

- Mark generated files with `🤖 AUTO-GENERATED` comment
- Include generation timestamp
- Add "DO NOT EDIT MANUALLY" warning
- Use `.generated.ts` suffix for generated files

## Configuration Files

- Project-specific configs in `config/` folder
- Package configs in individual package roots
- Use descriptive names: `db-setup.config.ts`, `i18n.config.ts`
- Separate config from implementation
