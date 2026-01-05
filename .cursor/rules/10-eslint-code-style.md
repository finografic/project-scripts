# ESLint & Code Style Rules

## Import Sorting & Organization

### Simple Import Sort Configuration

The project uses `simple-import-sort` for consistent import ordering. Imports must follow these grouping rules (in order):

1. **React & External Packages** - React, third-party libraries

   ```typescript
   import React from 'react';
   import { ComponentA } from 'react-library';
   import { zodResolver } from '@hookform/resolvers/zod';
   ```

2. **Internal Absolute Imports** - Components, forms, hooks

   ```typescript
   import { useToast } from 'components/Toast';
   import { FieldWrapper } from 'forms/FieldWrapper';
   ```

3. **Providers & App Context**

   ```typescript
   import { useAppConfig } from 'providers/AppConfigProvider';
   ```

4. **Config & Utilities**

   ```typescript
   import { MIN_TEMP_DIFFERENCE } from 'config/app';
   ```

5. **Admin/Pages (Absolute Imports)**

   ```typescript
   import { ORDER_FORM_SCHEMA, type OrdersFormValues } from 'admin/pages/AdminOrdersPage/OrdersForm/OrdersForm.schema';
   ```

6. **Relative Imports** - Local files, utilities

   ```typescript
   import { createFormSubmissionHandler } from './orders-form.submission';
   import { ProfilesPanel } from './ProfilesPanel';
   ```

7. **Side Effect Imports** - CSS, global styles

   ```typescript
   import 'primereact/resources/themes/lara-light-cyan/theme.css';
   ```

### Import Sorting - How to Handle

- **Automatic Fix**: Run `pnpm lint.fix -- path/to/file.tsx` to auto-sort imports
- **On Save**: Prettier runs on save; you may need to manually trigger ESLint fix for import sorting
- **Manual Fix**: Group imports according to the categories above, separated by blank lines

### Common Import Sorting Issues

**Problem**: Imports not in the correct order

```typescript
// ❌ Incorrect - mixed groupings
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from 'components/Toast';
import { ORDER_FORM_SCHEMA } from 'admin/pages/...';
import { useAppConfig } from 'providers/AppConfigProvider';
import { MIN_TEMP_DIFFERENCE } from 'config/app';
```

**Solution**: Group by category with blank lines between groups

```typescript
// ✅ Correct
import { zodResolver } from '@hookform/resolvers/zod';

import { useToast } from 'components/Toast';

import { useAppConfig } from 'providers/AppConfigProvider';

import { MIN_TEMP_DIFFERENCE } from 'config/app';
import { ORDER_FORM_SCHEMA } from 'admin/pages/...';

import { createFormSubmissionHandler } from './orders-form.submission';
import 'primereact/resources/themes/lara-light-cyan/theme.css';
```

## JSX Parentheses & Formatting

### Disable Conflicting ESLint Rules

The following ESLint rules are disabled in `eslint.config.mjs` to prevent conflicts with Prettier:

- `style/jsx-wrap-multilines` - Prettier handles JSX parentheses
- `react/jsx-wrap-multilines` - Let Prettier format JSX

This prevents the "add parentheses / remove parentheses" cycle where Prettier removes what ESLint adds.

### When to Use Parentheses in JSX

Let **Prettier handle this automatically**. Do not manually adjust JSX parentheses.

```typescript
// ✅ Let Prettier format this automatically
return (
  <section css={styles} className="admin-page-content form-container">
    <FormProvider {...methods}>
      <form id="order-form" onSubmit={handleSubmit(formSubmissionHandler)} noValidate>
        {/* content */}
      </form>
    </FormProvider>
  </section>
);
```

## Running ESLint Fixes

### Auto-fix specific file

```bash
pnpm lint.fix -- path/to/file.tsx
```

### Auto-fix all TypeScript files in a directory

```bash
pnpm lint.fix -- "src/**/*.tsx"
```

### Check without fixing

```bash
pnpm lint -- path/to/file.tsx
```

## Useful ESLint Rules Disabled

These rules are intentionally disabled to improve developer experience:

- `ts/no-unused-vars` - Unused imports are auto-removed by prettier
- `unused-imports/no-unused-imports` - Manual import management preferred
- `style/jsx-one-expression-per-line` - Let Prettier format expressions

## Best Practices

1. **Don't manually fix import order** - Use `pnpm lint.fix`
2. **Don't add/remove JSX parentheses** - Let Prettier handle it
3. **Group imports logically** - Follow the grouping rules above
4. **Blank lines between import groups** - Improves readability
5. **Run lint fix before committing** - Ensures consistent code style

