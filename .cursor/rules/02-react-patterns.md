# React & Frontend Rules

## Component Architecture

- Use functional components with hooks
- Prefer composition over inheritance
- Keep components small and focused on single responsibility
- Use TypeScript interfaces for props with clear documentation
- Export components as named exports, not default exports

## State Management

- Use React Context for app-wide state (theme, auth, etc.)
- Use local state (useState) for component-specific data
- Use useReducer for complex state logic
- Avoid prop drilling - use context or state lifting appropriately

## Styling Approach

- Use CSS-in-JS with Emotion for component styles
- Use your color system (colors.primary, colors.success, etc.)
- Avoid hardcoded colors - always use design tokens
- Use CSS variables for theming support
- Prefer semantic class names over utility classes

## Component Patterns

- Use forwardRef for components that need DOM access
- Implement proper loading and error states
- Use render props or hooks for logic reuse
- Create wrapper components for third-party libraries (like Radix)

## Function Parameters

- Follow TypeScript parameter patterns from `07-typescript-patterns.md`
- Use inline destructuring with type annotation for named parameters
- Prefer named parameters for functions with 2+ arguments

## Performance Optimizations

- Use React.memo for expensive pure components
- Optimize re-renders with useCallback and useMemo
- Use lazy loading for route components
- Avoid creating objects/functions in render

## Testing Considerations

- Write components that are easy to test
- Use data-testid attributes for test targeting
- Keep business logic separate from UI components
- Test user interactions, not implementation details
