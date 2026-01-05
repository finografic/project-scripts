# Internationalization (i18n) Rules

## Generated Types System

- Language types are AUTO-GENERATED in `config/generated/i18n/`
- Never manually edit generated files
- Use `pnpm generate:types` to regenerate types after config changes
- Generated types provide: `RegionLocale`, `LangCode2`, `CountryCode`, etc.

## Configuration

- Project-specific i18n config lives in `config/i18n/config.ts`
- Modify language support by updating the config file
- Generators create types based on your configuration
- Keep packages generic - project specifics go in config/

## Package Architecture

- `@workspace/i18n` - Reusable i18n utilities and generators
- `config/i18n/` - Project-specific language configuration
- `config/generated/i18n/` - Auto-generated types and constants
- Translation files in `packages/i18n/src/translations/`

## Usage Patterns

```typescript
// ✅ Use generated types
import type { RegionLocale, LangCode2 } from 'config/generated/i18n/language.types';

// ✅ Use generated constants
import { SUPPORTED_LOCALES, PRIMARY_LOCALES } from 'config/generated/i18n/constants.generated';

// ✅ Import generators for Node.js environments
import { generateTypes } from '@workspace/i18n/generators/generate-types';
```

## Development Workflow

1. Modify `config/i18n/config.ts` for language changes
2. Run generators to update types
3. Import generated types in your code
4. Never manually edit generated files

## Translation Management

- Use react-i18next for translations
- Store translations in JSON format
- Use Lokalize VSCode extension for translation management
- Follow the established translation file structure
