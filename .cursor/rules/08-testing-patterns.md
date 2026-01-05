# Testing Patterns & Best Practices

## File Naming Conventions

### Test File Extensions

- **ALWAYS** use `.test.ts` for consistency
- **AVOID** `.spec.ts` to maintain uniformity
- Use `.test.tsx` for React component tests

### Test File Organization

#### Use `__tests__/` folders for

- Complex utilities with multiple test files (3+ files)
- Integration tests
- Test utilities and shared mocks
- When you have multiple related test files in the same directory

#### Use sibling `.test.ts` files for

- **Single file utilities** (1 source file = 1 test file)
- **Simple components** (1-2 test files)
- **Single-purpose hooks or utilities**
- **Co-located testing** (easier to find and maintain)

## Test Structure Patterns

### Describe Block Naming

```typescript
// ✅ Correct - match the file/function being tested
describe('filters.utils', () => {
  describe('filterData', () => {
    // tests
  });
});

// ❌ Avoid - generic or unclear names
describe('data-filtering.utils', () => {
  describe('filtering logic', () => {
    // tests
  });
});
```

### Test Case Naming

```typescript
// ✅ Correct - describe the expected behavior
it('should filter by drinkType correctly', () => {
  // test
});

it('should handle empty data array', () => {
  // test
});

// ❌ Avoid - describe the implementation
it('should call filter method', () => {
  // test
});
```

## Mock Organization

### Mock File Structure

```
utils/filters/
├── __tests__/
│   ├── filters.utils.test.ts
│   └── filtering-simple.test.ts
├── mocks/
│   └── filters.utils.mocks.ts  # Shared mocks
├── filters.utils.ts
└── filters-flow.utils.ts
```

### Mock Naming Conventions

```typescript
// ✅ Correct - descriptive mock names
export const createMockData = (count: number = 10) => { /* ... */ };
export const createMockFilters = () => { /* ... */ };
export const createMockOrder = () => { /* ... */ };

// ❌ Avoid - generic names
export const mockData = { /* ... */ };
export const mockFilters = { /* ... */ };
```

## Vitest Configuration

### Recommended Setup

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

### Test Utilities

```typescript
// src/test/setup.ts
import { beforeEach } from 'vitest';

// Global test setup
beforeEach(() => {
  // Reset mocks, clear DOM, etc.
});
```

## Testing Best Practices

### Test Categories

1. **Unit Tests** - Test individual functions in isolation
2. **Integration Tests** - Test component interactions
3. **E2E Tests** - Test complete user workflows

### Test Structure

```typescript
describe('ComponentName', () => {
  // Setup
  let mockData: TestType;

  beforeEach(() => {
    mockData = createMockData();
  });

  describe('when condition is met', () => {
    it('should behave correctly', () => {
      // Arrange
      const input = mockData;

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toEqual(expectedOutput);
    });
  });
});
```

### Mock Guidelines

- **Mock external dependencies** (APIs, libraries)
- **Don't mock internal utilities** (test the real implementation)
- **Use factory functions** for creating test data
- **Keep mocks simple** and focused

## Migration from Jest to Vitest

### Compatibility

- Vitest is **Jest-compatible** - most tests work without changes
- Use `import { describe, it, expect } from 'vitest'` instead of Jest globals
- Configure `globals: true` for Jest-like global functions

### Performance Benefits

- **Faster execution** (Vite-powered)
- **Better TypeScript support**
- **Modern ESM support**
- **Hot module replacement** for tests

## File Organization Examples

### Simple Utility (sibling test)

```
utils/
├── string.utils.ts
└── string.utils.test.ts
```

### Complex Utility (**tests** folder)

```
utils/filters/
├── __tests__/
│   ├── filters.utils.test.ts
│   ├── filters-flow.utils.test.ts
│   └── integration.test.ts
├── mocks/
│   └── filters.utils.mocks.ts
├── filters.utils.ts
└── filters-flow.utils.ts
```

### Component Testing

```
components/Button/
├── Button.tsx
├── Button.test.tsx
├── Button.styles.ts
└── Button.types.ts
```
