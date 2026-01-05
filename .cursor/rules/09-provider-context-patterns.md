# Provider & Context Patterns

## 3-File Rule Structure

### Core Pattern

Each provider follows a strict **3-file structure** for maximum maintainability:

```
providers/ProviderName/
├── ProviderNameContext.ts      # Main context logic & implementation
├── ProviderNameContext.types.ts # Type definitions (lib-like, rarely touched)
└── ProviderNameProvider.tsx    # Provider component (rarely touched)
```

### File Responsibilities

#### 1. `ProviderNameContext.ts` - **MAIN MAINTENANCE FILE**

- **Enum definitions** - Key definitions for state properties
- **Default values** - Initial state values (linked to enum keys)
- **All business logic** - Custom methods and complex operations
- **Auto-generated setters** - Typed setters created automatically
- **Store implementation** - Core Zustand store logic

#### 2. `ProviderNameContext.types.ts` - **LIB-LIKE FILE (RARELY TOUCHED)**

- **Interface definitions** - Clean, minimal type contracts
- **Action signatures** - Method type definitions
- **Provider props** - Component prop types
- **Store types** - Final store interface

#### 3. `ProviderNameProvider.tsx` - **MOUNTING FILE (RARELY TOUCHED)**

- **Provider component** - React Context provider wrapper
- **Initial value handling** - Default state setup
- **Children rendering** - Basic component structure

## Exception: 4-File Rule for Complex Types

### When to Add `provider-name-utils.types.ts`

Add a 4th file when:
- **Complex method signatures** - Methods with 3+ parameters
- **Reusable parameter types** - Types used across multiple methods
- **Clean separation needed** - To keep `Context.types.ts` lib-like

### Example: Named Parameters Pattern

```typescript
// ❌ Before - Noisy Context.types.ts
handleRouteChange: (
  filterKey: FilterKey | undefined,
  loaderData: DataEntry[],
  padsConfig: PadConfig,
  dataPool: DataEntry[] | OrderModel[] | OrderReadableModel[],
  serverFieldMap: Record<string, string>,
  currentLanguage?: RegionLocale,
) => void;

// ✅ After - Clean Context.types.ts
handleRouteChange: (params: HandleRouteChangeParams) => void;
```

### Benefits of 4-File Pattern

- **-66% noise reduction** in `Context.types.ts`
- **-20% line reduction** overall
- **Better maintainability** - Types co-located with usage
- **Cleaner imports** - Fewer type imports in main types file

## Implementation Guidelines

### Context.ts Structure

```typescript
// 1. Key definitions (enum)
export enum ContextKeys {
  property1 = 'property1',
  property2 = 'property2',
}

// 2. Default values (linked to enum)
export const defaultValue: ContextValues = {
  [ContextKeys.property1]: initialValue1,
  [ContextKeys.property2]: initialValue2,
};

// 3. Store implementation
export const ContextName = createZustandContext(({ initialValue }) => {
  return createStore<ContextStore>()(
    (set, get): ContextStore => ({
      ...defaultValue,
      ...initialValue,
      actions: {
        // Auto-generated setters
        ...createSetters({ set, defaultValue, prefix: SETTER_PREFIX }),

        // Custom business logic
        customMethod: ({ param1, param2 }: CustomMethodParams) => {
          // Implementation
        },
      },
    }),
  );
});
```

### Context.types.ts Structure

```typescript
// Clean, minimal type definitions
export interface ContextValues {
  [ContextKeys.property1]: Property1Type;
  [ContextKeys.property2]: Property2Type;
}

type ContextSetters = CreateSettersType<ContextValues, typeof SETTER_PREFIX>;

type ContextActions = ContextSetters & {
  customMethod: (params: CustomMethodParams) => void;
};

export interface ContextStore extends ContextValues {
  actions: ContextActions;
}
```

### Utils Types Structure (when needed)

```typescript
// Complex parameter types
export interface CustomMethodParams {
  param1: Param1Type;
  param2: Param2Type;
  param3?: Param3Type;
}

// Reusable types
export interface SharedType {
  // Type definition
}
```

## Auto-Generated Setters Pattern

### Benefits

- **Type-safe setters** - Automatically generated from value types
- **Consistent naming** - `setPropertyName` pattern
- **Zero maintenance** - No manual setter creation needed
- **Prefix support** - `setUiPropertyName` with prefixes

### Usage

```typescript
// Auto-generated from ContextValues
const { setProperty1, setProperty2 } = useContextName();

// Custom methods alongside auto-generated ones
const { setProperty1, customMethod } = useContextName();
```

## Naming Conventions

### Files

- `ProviderNameContext.ts` - Main implementation
- `ProviderNameContext.types.ts` - Type definitions
- `ProviderNameProvider.tsx` - Provider component
- `provider-name-utils.types.ts` - Complex parameter types (when needed)

### Constants

- `DISPLAY_NAME` - Context display name for errors
- `SETTER_PREFIX` - Prefix for auto-generated setters
- `defaultValue` - Initial state values
- `ContextKeys` - Enum for property keys

### Hooks

- `useProviderName()` - Main hook for consuming context

## Best Practices

### Context.ts (Maintenance File)

- **Keep enum and defaults together** - Easy to maintain consistency
- **Use named parameters** for methods with 2+ parameters
- **Extract complex types** to utils file when needed
- **Document business logic** with clear comments

### Context.types.ts (Lib File)

- **Minimize imports** - Only essential types
- **Keep interfaces clean** - Focus on contracts, not implementation
- **Use parameter objects** for complex method signatures
- **Avoid implementation details** - Pure type definitions

### Utils Types (When Needed)

- **Co-locate with usage** - Types near methods that use them
- **Use descriptive names** - `MethodNameParams` pattern
- **Document complex types** - JSDoc for parameter objects
- **Export only what's needed** - Minimal public interface

## Migration Pattern

### From Noisy to Clean

1. **Identify complex signatures** - Methods with 3+ parameters
2. **Create parameter interfaces** - Extract to utils types file
3. **Update method signatures** - Use single parameter object
4. **Update implementations** - Use inline destructuring
5. **Clean up imports** - Remove unused type imports

### Example Migration

```typescript
// Before: Noisy types file
import type { FilterKey } from 'types/orders.types';
import type { DataEntry } from 'types/data.types';
import type { RegionLocale } from '@workspace/i18n';
import type { OrderModel } from 'types/models/order.model';
import type { OrderReadableModel } from 'types/models/order-readable.model';

handleRouteChange: (
  filterKey: FilterKey | undefined,
  loaderData: DataEntry[],
  padsConfig: PadConfig,
  dataPool: DataEntry[] | OrderModel[] | OrderReadableModel[],
  serverFieldMap: Record<string, string>,
  currentLanguage?: RegionLocale,
) => void;

// After: Clean types file
import type { HandleRouteChangeParams } from './layout-ui-utils.types';

handleRouteChange: (params: HandleRouteChangeParams) => void;
```

## Tool Integration

This pattern is designed to work with custom Zustand context utilities that provide:
- **Auto-generated setters** - Type-safe setter creation
- **Context integration** - Seamless React Context setup
- **Type inference** - Full TypeScript support
- **Minimal boilerplate** - Quick setup and maintenance

The eventual CLI generator will create this structure automatically, ensuring consistency across all providers.
