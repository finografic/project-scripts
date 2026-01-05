# AI Rules: i18n Message Generation

## Overview

When generating or modifying i18n translation keys, content, or TypeScript parsers, follow these rules to ensure consistency with the Inlang/Paraglide setup.

## Source JSON File Rules

### 1. File Structure
- **Location**: `apps/client/messages/{folder}/{locale}.json`
  - `{folder}` = `app`, `admin`, or `shared`
  - `{locale}` = `en-GB`, `es-ES`, or `ca-ES`
- **Always include** `$schema` at the top:
  ```json
  {
    "$schema": "https://inlang.com/schema/inlang-message-format",
    ...
  }
  ```

### 2. Key Naming
- **Use snake_case** for all keys (e.g., `admin_dashboard_title`)
- **Use descriptive prefixes** to group related messages:
  - `admin_*` for admin pages
  - `app_*` for app pages
  - `shared_*` for shared components
- **Follow pattern**: `{prefix}_{section}_{item}` (e.g., `admin_dashboard_title`)

### 3. Basic Messages (No Variants)
For simple messages without role/element variations:
```json
{
  "admin_items_title": "Records Management",
  "admin_items_description": "Manage database records"
}
```

### 4. Variant Messages (With Selectors)
For messages that vary by role, element, or other inputs:
```json
{
  "admin_dashboard": [
    {
      "selectors": ["element", "role"],
      "match": {
        "element=title, role=admin": "Admin Dashboard",
        "element=title, role=public": "User Dashboard",
        "element=description, role=admin": "Control panel - system management",
        "element=description, role=public": "Control panel - maintenance utilities"
      }
    }
  ]
}
```

**Rules for Variants:**
- Use array syntax with `selectors` and `match` object
- `selectors` array defines input parameter names
- `match` object uses `selector=value` syntax
- **Must define all combinations** for each locale
- Keep selector order consistent: `["element", "role"]` (matches `defaultSelectorOrder` in settings)

### 5. Consistency Across Locales
- **Same structure** for all locales (en-GB, es-ES, ca-ES)
- **Same selectors** for variant messages
- **Same match patterns** (only values differ)

## TypeScript Parser Rules

### 1. Helper Function Location
- **File**: `apps/client/src/utils/i18n/i18n-inlang.messages.ts`
- **Pattern**: Export helper functions that wrap Paraglide `m` functions

### 2. Basic Message Helpers
For simple messages:
```typescript
export const getAdminItems = () => ({
  title: m.admin_items_title(),
  description: m.admin_items_description(),
});
```

### 3. Variant Message Helpers
For variant messages, match the selector pattern:
```typescript
export const getAdminDashboard = (inputs: { role: 'public' | 'admin' }) => ({
  title: m.admin_dashboard({ element: 'title', role: inputs.role }),
  description: m.admin_dashboard({ element: 'description', role: inputs.role }),
});
```

**Rules:**
- Function name: `get{SectionName}` (e.g., `getAdminDashboard`)
- Input type: Match selector names and types from JSON
- Return object with descriptive property names
- Use `m.{key}({ selector: value })` syntax for variant calls

### 4. Type Safety
- **Always type inputs** explicitly (e.g., `{ role: 'public' | 'admin' }`)
- **Use consistent types** across helpers (don't mix `'admin' | 'user'` with `'admin' | 'public'`)
- **Match selector values** exactly as defined in JSON

### 5. Helper Function Naming
- Pattern: `get{SectionName}` (PascalCase section name)
- Examples:
  - `getAdminDashboard`
  - `getAdminTranslations`
  - `getAdminLanguages`

## Workflow Rules

### When Adding New Messages

1. **Add to all locale files** (en-GB, es-ES, ca-ES)
2. **Use variant syntax** if role/element variations are needed
3. **Compile messages**: `pnpm i18n.paraglide.compile`
4. **Create helper function** in `i18n-inlang.messages.ts` if needed
5. **Use in components** via helper or direct `m` call

### When Modifying Existing Messages

1. **Update all locale files** simultaneously
2. **Maintain variant structure** if using variants
3. **Recompile** after changes
4. **Update helper functions** if selector structure changes

## Common Patterns

### Role-Based Variants
```json
{
  "admin_dashboard": [
    {
      "selectors": ["element", "role"],
      "match": {
        "element=title, role=admin": "...",
        "element=title, role=public": "..."
      }
    }
  ]
}
```

### Element-Based Variants
```json
{
  "admin_card": [
    {
      "selectors": ["element"],
      "match": {
        "element=title": "...",
        "element=description": "..."
      }
    }
  ]
}
```

## DO NOT

- ❌ Use camelCase for keys (use snake_case)
- ❌ Mix variant and non-variant syntax for the same message
- ❌ Skip the `$schema` declaration
- ❌ Create inconsistent selector orders across messages
- ❌ Define variants in only one locale (must be in all)
- ❌ Use different selector names for the same concept (e.g., `role` vs `userRole`)

## DO

- ✅ Always include `$schema` in JSON files
- ✅ Use snake_case for all keys
- ✅ Keep variants consistent across all locales
- ✅ Create helper functions for complex variant structures
- ✅ Type all helper function inputs explicitly
- ✅ Recompile after JSON changes
- ✅ Group related messages in the same helper function

## References

- Source JSON format: `apps/client/messages/MESSAGES_I18N.SOURCE_JSON.md`
- TypeScript parsing: `apps/client/src/i18n/MESSAGES_I18N.PARSING.md`
- Full guide: `apps/client/docs/MESSAGES_I18N.FULL.md`

