# Custom Button Component Usage

## Rule: Always Use Custom Button Component

**Always use the custom `@components/Button` component instead of Radix UI's `Button`.**

This ensures:
- ✅ Consistent styling across the application
- ✅ Integration with design system colors and variants
- ✅ Unified loading states and disabled states
- ✅ Proper icon support and positioning
- ✅ Controlled behavior and customization

---

## DO ✅

```tsx
import { Button } from 'components/Button';

export const MyComponent = () => {
  return (
    <>
      {/* Basic button */}
      <Button onClick={handleClick}>Click me</Button>

      {/* With variants and colors */}
      <Button variant="outline" color="gray">Cancel</Button>
      <Button color="success">Save</Button>

      {/* With loading state */}
      <Button loading={isLoading}>Submit</Button>

      {/* With icons */}
      <Button icon={<DeleteIcon />} iconPosition="left">Delete</Button>

      {/* Full width */}
      <Button fullWidth>Full Width Button</Button>

      {/* Different sizes */}
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </>
  );
};
```

---

## DON'T ❌

```tsx
import { Button } from '@radix-ui/themes';

export const MyComponent = () => {
  return (
    <>
      {/* ❌ WRONG - Using Radix Button */}
      <Button onClick={handleClick}>Click me</Button>
    </>
  );
};
```

---

## Custom Button Features

The custom Button component provides:

| Feature | Support | Notes |
|---------|---------|-------|
| Variants | `solid`, `outline`, `ghost` | Design system variants |
| Colors | `default`, `success`, `danger`, `gray`, etc. | Integrated with theme colors |
| Sizes | `sm`, `md`, `lg` | Responsive sizing |
| Loading State | `loading: boolean` | Shows spinner, disables interaction |
| Icon Support | `icon`, `iconPosition: 'left' \| 'right'` | Proper alignment and spacing |
| Full Width | `fullWidth: boolean` | Container width button |
| Disabled State | `disabled: boolean` | Proper styling and interaction prevention |

---

## Common Imports to Replace

### When refactoring, look for and replace:

```tsx
// ❌ Remove
import { Button } from '@radix-ui/themes';

// ✅ Replace with
import { Button } from 'components/Button';
```

---

## File Location

- **Component:** `apps/client/src/components/Button/Button.tsx`
- **Types:** `apps/client/src/components/Button/Button.types.ts`
- **Styles:** `apps/client/src/components/Button/Button.styles.ts`
- **Utils:** `apps/client/src/components/Button/utils/button.utils.ts`

---

## Examples in Codebase

Good examples of custom Button usage:
- `apps/client/src/admin/pages/AdminOrdersPage/AdminOrdersListPage.tsx`
- `apps/client/src/admin/pages/AdminOrdersPage/AdminOrderEditPage.tsx`

Use these as reference when implementing new buttons.

