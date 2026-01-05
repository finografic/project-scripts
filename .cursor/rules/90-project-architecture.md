# Project Architecture Rules

## Smart Fallback System

### Critical Rules for Temperature Profile Generation

**⚠️ Temperature profiles are EXPENSIVE operations. Follow these rules strictly.**

---

## 🚨 DO NOT Generate Temperature Profiles Outside These Conditions

Temperature profiles should **ONLY** be generated when **ALL** of these conditions are true:

### 1. Correct Routes ONLY

```typescript
✅ ALLOWED:
- /container-type
- /temperature

❌ FORBIDDEN:
- /drink-type
- /volume
- /time
- MainPage
- Any other route
```

### 2. Correct Flow Type ONLY

```typescript
✅ ALLOWED:
- session.flowType === 'program-product'

❌ FORBIDDEN:
- session.flowType === 'program-time'
- No session exists
```

### 3. When Data Is Missing ONLY

```typescript
✅ ALLOWED:
- dataFiltered.length === 0

❌ FORBIDDEN:
- dataFiltered.length > 0 (use database entries instead)
```

---

## ✅ Correct Pattern

```typescript
// ✅ GOOD: Four-layer safety net
const smartFallbackEntry = useMemo(() => {
  // Layer 1: Session check
  if (!currentSessionId) return null;

  // Layer 2: Flow type check
  if (session.flowType === FLOW_TYPES.PROGRAM_TIME) return null;

  // Layer 3: Route check
  const isOnRelevantRoute =
    pathname === PATHS.containerType ||
    pathname === PATHS.temperature;
  if (!isOnRelevantRoute) return null;

  // Layer 4: Data check
  if (dataFiltered.length > 0) return null;

  // ✅ All checks passed - safe to generate
  return generateTemperatureProfiles(modeId, drinkType);
}, [/* dependencies */]);
```

---

## ❌ Anti-Patterns

### 1. Generating on Early Pages

```typescript
// ❌ BAD: Generates on drink-type page
useEffect(() => {
  if (!dataFiltered.length) {
    generateTemperatureProfiles(modeId, drinkType);
  }
}, [dataFiltered]);
```

### 2. Forgetting Flow Type Check

```typescript
// ❌ BAD: Generates for time flow
if (!dataFiltered.length) {
  generateTemperatureProfiles(modeId, drinkType);
}
```

### 3. Not Checking Route

```typescript
// ❌ BAD: Generates on every page
const profiles = generateTemperatureProfiles(modeId, drinkType);
```

### 4. Calling Hook Unconditionally

```typescript
// ⚠️ CAREFUL: This still runs the hook on every page
// Make sure useSmartFallback has internal route checks
const { createFallbackEntry } = useSmartFallback();
```

---

## 🎯 Flow Type Discrimination

Always check `session.flowType` before product-specific logic:

```typescript
// ✅ GOOD: Check flow type first
if (session.flowType === FLOW_TYPES.PROGRAM_PRODUCT) {
  // Product-specific logic here
}

// ❌ BAD: Assuming all sessions need product logic
const profiles = generateTemperatureProfiles(modeId, drinkType);
```

---

## 📊 Performance Rules

### 1. Lazy Loading

- ✅ Generate data **only when user reaches the page that needs it**
- ❌ Do NOT pre-generate data "just in case"

### 2. Memoization

- ✅ Use `useMemo` for expensive calculations
- ✅ Include proper dependencies
- ❌ Do NOT recalculate on every render

### 3. Early Returns

- ✅ Check cheapest conditions first (session check)
- ✅ Exit early when possible
- ❌ Do NOT run expensive checks if earlier checks fail

---

## 🔧 useSmartFallback Hook

**Location:** `src/hooks/useSmartFallback.ts`

**This hook is the ONLY place temperature profiles should be generated.**

If you need temperature profiles elsewhere:
1. ✅ Call `useSmartFallback()` hook
2. ✅ Trust its four-layer safety net
3. ❌ Do NOT call `generateTemperatureProfiles()` directly

---

## 📝 When Modifying Smart Fallback Logic

### Before Changing

1. Read `docs/SMART_FALLBACK_ARCHITECTURE.md`
2. Understand the four-layer safety net
3. Consider performance impact

### Required Checks

When modifying `useSmartFallback`, ensure ALL layers are present:
- [ ] Layer 1: Session check (`!currentSessionId`)
- [ ] Layer 2: Flow type check (`flowType === PROGRAM_TIME`)
- [ ] Layer 3: Route check (`isOnRelevantRoute`)
- [ ] Layer 4: Data check (`dataFiltered.length > 0`)

### After Changing

1. Test on early product pages (should NOT generate profiles)
2. Test on container-type page (SHOULD generate if no data)
3. Test on time page (should NOT generate profiles)
4. Check console for unwanted profile logs

---

## 🚨 Red Flags

If you see these in console, something is wrong:

```
❌ BAD: Profiles generated on drink-type page
🚨 TEMP PROFILE: Generating profiles for cerveza (index: 0)

❌ BAD: Profiles generated on time page
🚨 TEMP PROFILE: Generating profiles for cerveza (index: 0)

❌ BAD: Multiple profile generations
🚨 TEMP PROFILE: Generating profiles for cerveza (index: 0)
🚨 TEMP PROFILE: Generating profiles for cerveza (index: 0)
🚨 TEMP PROFILE: Generating profiles for cerveza (index: 0)
```

✅ GOOD: Profiles generated only once on container-type/temperature pages:

```
🚨 TEMP PROFILE: Generating profiles for cerveza (index: 0)
🚨 TEMP PROFILE: Base time: 30s
🚨 TEMP PROFILE: 25°C → timeA=30s, timeB=45s, timeC=60s
... (one time only, on correct page)
```

---

## 🎓 Key Principles

1. **Expensive Operations = Lazy Loading**
   - Only run when user reaches the page that needs it

2. **Flow Type = Logic Discriminator**
   - Use `session.flowType` to determine which logic to run

3. **Route = Optimization Boundary**
   - Only run logic on routes that actually use it

4. **Defense in Depth**
   - Four layers of checks prevent unnecessary work

5. **Trust the Hook**
   - `useSmartFallback` has built-in safety nets
   - Don't bypass it by calling generator directly

---

## 📚 Reference

**Detailed Documentation:** `docs/SMART_FALLBACK_ARCHITECTURE.md`

**Key Files:**
- `src/hooks/useSmartFallback.ts` - Core hook
- `src/utils/temperature-profile-generator.ts` - Pure generator function
- `src/hooks/useProcessTimesFromTemperatureFilter.ts` - Uses smart fallback

**Related Rules:**
- Performance optimization rules
- React hooks best practices
- Session management patterns

---

**Last Updated:** 2025-10-25
**Priority:** HIGH - Core architecture pattern

