# Modern TypeScript Patterns

## Purpose

This project is a **learning environment** for modern TypeScript patterns. AI assistants should proactively suggest and use modern patterns when appropriate, not just when explicitly requested.

---

## Guiding Principles

### ✅ DO: Suggest Modern Patterns

When solving problems, consider modern approaches:

- **Branded types** for distinct primitives (IDs, units, validated strings)
- **Result types** for explicit error handling
- **Discriminated unions** for state machines
- **Type-level programming** for compile-time safety
- **Runtime validation** (Zod) for external data
- **Type utilities** (type-fest) for complex transformations

### ✅ DO: Balance Modern vs Simple

- Use modern patterns when they **add meaningful value**
- Don't over-engineer simple problems
- Explain the pattern when introducing it
- Provide links to learning resources

### ❌ DON'T: Force Advanced Patterns

- Don't use fp-ts/Effect-TS unless explicitly requested
- Don't replace working code just to be "modern"
- Don't use patterns the user isn't ready for

---

## Pattern Decision Guide

### When to Suggest Branded Types

**YES** ✅ - Suggest branding for:
```typescript
// IDs from different entities
type UserId = Brand<number, 'UserId'>;
type OrderId = Brand<number, 'OrderId'>;

// Different units
type USD = Brand<number, 'USD'>;
type EUR = Brand<number, 'EUR'>;

// Validated strings
type Email = Brand<string, 'Email'>;

// Constrained values (our use case!)
type Contrast = Brand<number, 'Contrast'>;
```

**NO** ❌ - Don't brand:
- Simple local variables
- Types that are already distinct (classes, objects)
- When only used in one place

---

### When to Suggest Runtime Validation

**YES** ✅ - Suggest Zod for:
```typescript
// API responses
const UserSchema = z.object({ id: z.number(), name: z.string() });
const user = UserSchema.parse(apiResponse);

// Form validation
const schema = z.object({ email: z.string().email() });

// Environment variables
const env = z.object({ API_URL: z.string().url() }).parse(process.env);
```

**NO** ❌ - Don't validate:
- Internal functions with typed parameters
- Build-time constants
- Already-validated data

---

### When to Suggest Type Utilities

**YES** ✅ - Use type-fest for:
```typescript
import type { Simplify, PartialDeep, RequireAtLeastOne } from 'type-fest';

// Complex type transformations
type SimpleUser = Simplify<User & Admin & Permissions>;

// Deep partial for nested configs
type PartialConfig = PartialDeep<AppConfig>;
```

**NO** ❌ - Don't use when:
- Native utility types work fine (`Partial`, `Pick`, `Omit`)
- Would add unnecessary complexity

---

### When to Suggest Modern Patterns

**Result Types** ✅
```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// Good for: Functions that can fail predictably
function parseJSON(str: string): Result<unknown> { /* ... */ }
```

**State Machines** ✅
```typescript
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: string }
  | { status: 'error'; error: Error };

// Good for: Complex async flows, UI states
```

**Builder Pattern** ✅
```typescript
// Good for: Complex object construction, fluent APIs
```

---

## Pattern Introduction Template

When introducing a new pattern, explain briefly:

```markdown
I'm using [PATTERN NAME] here because [REASON].

[1-2 sentence explanation of how it works]

📘 Learn more: [Link to docs/guide]
```

**Example**:
```markdown
I'm using branded types here because we need to distinguish UserId from OrderId
even though they're both numbers.

This creates distinct types at compile time with zero runtime cost.

📘 Learn more: TYPESCRIPT_BRANDING.md
```

---

## Project-Specific Preferences

### Installed & Preferred

These libraries are **installed** and **should be suggested**:

- ✅ **type-fest** - Use for advanced type utilities
- ✅ **ts-extras** - Use for runtime utilities
- ✅ **zod** (if installed) - Preferred for validation

### DIY Patterns (Zero Dependencies)

These patterns should be **suggested without hesitation**:

- ✅ **Branded types** (DIY approach, no library needed)
- ✅ **Result types** (simple discriminated union)
- ✅ **State machines** (discriminated unions)
- ✅ **Type-safe event emitters**

### Avoid Unless Requested

- ❌ **fp-ts** - Too advanced, only if user asks
- ❌ **Effect-TS** - Expert-level, only if user asks
- ❌ **io-ts** - Prefer Zod unless FP is established pattern

---

## Examples of Good Suggestions

### Example 1: Suggesting Branded Types

**User**: "I need to create UserId and OrderId types"

**Good Response** ✅:
```typescript
// Using branded types to make IDs distinct
type UserId = number & { readonly __brand: 'UserId' };
type OrderId = number & { readonly __brand: 'OrderId' };

// Helper functions for type-safe creation
function userId(id: number): UserId {
  if (id <= 0) throw new Error('Invalid user ID');
  return id as UserId;
}

function orderId(id: number): OrderId {
  if (id <= 0) throw new Error('Invalid order ID');
  return id as OrderId;
}

// Now these are distinct types!
const user = userId(123);
const order = orderId(456);

getUserData(order); // ❌ Type error!
```

I'm using branded types here because TypeScript normally sees both as `number`
and would allow mixing them up. Branding makes them distinct at compile time.

📘 Learn more: [TYPESCRIPT_BRANDING.md](./TYPESCRIPT_BRANDING.md)

---

### Example 2: Suggesting Result Types

**User**: "How do I handle errors in this function?"

**Good Response** ✅:
```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function parseConfig(json: string): Result<Config> {
  try {
    const data = JSON.parse(json);
    return { ok: true, value: data };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
}

// Usage
const result = parseConfig(jsonString);
if (result.ok) {
  console.log(result.value); // ✅ TypeScript knows value exists
} else {
  console.error(result.error); // ✅ TypeScript knows error exists
}
```

This Result type makes error handling explicit instead of relying on exceptions.
TypeScript ensures you check for both success and failure cases.

---

### Example 3: Using Type-Fest

**User**: "How do I make a deep partial type?"

**Good Response** ✅:
```typescript
import type { PartialDeep } from 'type-fest';

type Config = {
  api: {
    url: string;
    timeout: number;
  };
  features: {
    darkMode: boolean;
  };
};

type PartialConfig = PartialDeep<Config>;
// All properties at all levels are optional

// Or use native Partial for shallow:
type ShallowPartial = Partial<Config>; // Only top level is optional
```

Since you have type-fest installed, `PartialDeep` handles nested objects better
than the native `Partial` utility type.

---

## When NOT to Suggest Modern Patterns

### Avoid Over-Engineering

**User**: "How do I add two numbers?"

**Bad Response** ❌:
```typescript
// Don't do this!
type PositiveInt = Brand<number, 'PositiveInt'>;
function add(a: PositiveInt, b: PositiveInt): PositiveInt { /* ... */ }
```

**Good Response** ✅:
```typescript
function add(a: number, b: number): number {
  return a + b;
}
```

**Explanation**: Simple problems deserve simple solutions. Don't suggest patterns
when native TypeScript is sufficient.

---

### Avoid Unfamiliar Advanced Patterns

**User**: "How do I handle this async operation?"

**Bad Response** ❌:
```typescript
import * as TE from 'fp-ts/TaskEither';
// Using fp-ts without being asked
```

**Good Response** ✅:
```typescript
async function fetchUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}

// Or with Zod validation:
const result = UserSchema.safeParse(await response.json());
```

**Explanation**: Stick to familiar patterns unless the user explicitly wants FP approaches.

---

## Learning Resources Available

When suggesting patterns, reference these docs:

- 📘 [TYPESCRIPT_BRANDING.md](./TYPESCRIPT_BRANDING.md) - Branded types guide
- 📘 [TYPESCRIPT_ECOSYSTEM_01_NATIVE.md](./TYPESCRIPT_ECOSYSTEM_01_NATIVE.md) - Native TypeScript
- 📘 [TYPESCRIPT_ECOSYSTEM_02_VALIDATION.md](./TYPESCRIPT_ECOSYSTEM_02_VALIDATION.md) - Runtime validation
- 📘 [TYPESCRIPT_ECOSYSTEM_03_MODERN_PATTERNS.md](./TYPESCRIPT_ECOSYSTEM_03_MODERN_PATTERNS.md) - Modern patterns
- 📘 [TYPESCRIPT_ECOSYSTEM_04_ADVANCED.md](./TYPESCRIPT_ECOSYSTEM_04_ADVANCED.md) - Advanced (fp-ts, Effect)

---

## Summary

This project is about **learning modern TypeScript**. AI assistants should:

✅ **Proactively suggest** modern patterns when they add value
✅ **Explain** patterns when introducing them
✅ **Link** to learning resources
✅ **Balance** modern with simplicity
❌ **Don't** over-engineer simple problems
❌ **Don't** force advanced FP patterns (fp-ts/Effect)

**Goal**: Help the user learn by seeing modern patterns in action, not by overwhelming them.

