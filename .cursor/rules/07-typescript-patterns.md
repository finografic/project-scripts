# TypeScript Patterns & Best Practices

## Function Parameter Patterns

### Named Parameters with Inline Destructuring

- **ALWAYS** use inline destructuring with type annotation for named parameters
- **NEVER** use separate destructuring assignment after parameter declaration
- **PREFER** named parameters over positional parameters for functions with 2+ arguments

```typescript
// ✅ Correct - inline destructuring with type
handleRouteChange: ({
  filterKey,
  loaderData,
  padsConfig,
  dataPool,
  serverFieldMap,
  currentLanguage = 'es-ES',
}: HandleRouteChangeParams) => {
  // function body
}

// ❌ Avoid - separate destructuring
handleRouteChange: (params: HandleRouteChangeParams) => {
  const {
    filterKey,
    loaderData,
    padsConfig,
    dataPool,
    serverFieldMap,
    currentLanguage = 'es-ES',
  } = params;
  // function body
}
```

### Named Parameters Preference

- **ALWAYS** use named parameters for functions with 2+ arguments
- **PREFER** named parameters even for single-argument functions when the parameter is complex
- **CREATE** interfaces for parameter objects to ensure type safety

```typescript
// ✅ Correct - named parameters with interface
interface CreateUserParams {
  name: string;
  email: string;
  role: 'admin' | 'user';
  isActive?: boolean;
}

const createUser = ({ name, email, role, isActive = true }: CreateUserParams) => {
  // implementation
}

// ❌ Avoid - positional parameters
const createUser = (name: string, email: string, role: 'admin' | 'user', isActive = true) => {
  // implementation
}

// ✅ Correct - single complex parameter
interface ProcessOrderParams {
  orderId: string;
  paymentMethod: PaymentMethod;
  shippingAddress: Address;
  metadata?: Record<string, any>;
}

const processOrder = ({ orderId, paymentMethod, shippingAddress, metadata }: ProcessOrderParams) => {
  // implementation
}
```

## Benefits of These Patterns

### Inline Destructuring Benefits

- **Better type safety** - Direct parameter-to-interface matching
- **Improved readability** - Immediate visibility of all parameters
- **Cleaner code** - No intermediate variable assignments
- **Better IDE support** - Enhanced autocomplete and error detection

### Named Parameters Benefits

- **Self-documenting code** - Parameter names explain their purpose
- **Order independence** - Parameters can be passed in any order
- **Easier refactoring** - Adding/removing parameters is safer
- **Better maintainability** - Clear function signatures
- **Reduced errors** - Less chance of passing arguments in wrong order

## Usage Guidelines

### When to Use Named Parameters

- Functions with 2+ parameters
- Complex parameter objects
- Optional parameters
- Functions that may grow in parameter count
- Public APIs and interfaces

### When Positional Parameters Are Acceptable

- Single parameter functions
- Simple utility functions with clear parameter order
- Mathematical operations where order is obvious
- Legacy code compatibility

## TypeScript-Specific Considerations

- Use `interface` for parameter objects to ensure extensibility
- Provide default values in the parameter destructuring when appropriate
- Use union types for constrained parameter values
- Consider using `Pick` or `Omit` for parameter variations
- Use generic types for reusable parameter patterns
