# Linting & Code Style Rules

## Import Sorting

- Use `simple-import-sort` and group imports logically (external → internal → relative → side-effects)
  separated by blank lines.
- Prefer auto-fix via oxfmt; avoid manual reordering.

## JSX Formatting

- Let Prettier control parentheses and multiline formatting; avoid manual tweaks.

## Fixing

```bash
pnpm lint -- path/to/file.tsx
pnpm lint:fix -- path/to/file.tsx
pnpm lint:fix -- "src/**/*.tsx"
```

## Disabled Rules (intentional)

- `style/jsx-wrap-multilines`, `react/jsx-wrap-multilines` (Prettier governs formatting)
- `ts/no-unused-vars` in favor of import cleanup
