# Styling & Design System Rules

## Color System Usage

- ALWAYS use the color system: `colors.primary`, `colors.success`, etc.
- Never use hardcoded hex colors or CSS color names
- Use color variants: `colors.primaryLight`, `colors.primaryDark` for states
- Use transparency variants: `colors.primary25`, `colors.primary50` for overlays
- Colors auto-adapt to light/dark themes via CSS variables

## Available Colors

Base colors: `default`, `primary`, `secondary`, `success`, `warning`, `danger`, `info`, `grey`

Usage examples:

```typescript
// ✅ Correct
background-color: ${colors.primary};
color: ${colors.white};
border: 1px solid ${colors.primaryDark};

// ❌ Avoid
background-color: #1e3a8a;
color: white;
```

## Component Styling

- Use CSS-in-JS with Emotion
- Create style objects in separate `.styles.ts` files for complex components
- Use the `css` function for dynamic styles
- Leverage your button, layout, and spacing constants
- Use semantic class names: `button-*` instead of `btn-*` for clarity and consistency

## Icon System

- Use your centralized icon system from `styles/icons`
- Icons automatically get `.icon` class and proper styling
- Access original Radix/Lucide names via data attributes
- Use semantic names: `<CloseIcon />`, `<DropdownIcon />`

## Responsive Design

- Use your breakpoint system from `styles/viewport`
- Mobile-first approach with `min-width` media queries
- Test on multiple screen sizes
- Consider touch targets for mobile devices

## Transitions & Animations

- ALWAYS use `ms` units for transition and animation durations
- Target specific properties instead of `transition: all` for better performance
- Use appropriate durations based on interaction type:
  - `150ms` for quick interactions (hover, focus, form inputs)
  - `200ms` for standard interactions (button clicks, card interactions)
  - `300ms` for page transitions and complex animations

Usage examples:

```typescript
// ✅ Correct - specific properties with ms units
transition: color 150ms ease, border-color 150ms ease, background-color 150ms ease, transform 150ms ease;

// ✅ Correct - single property
transition: opacity 200ms ease;

// ❌ Avoid - seconds units
transition: color 0.15s ease;

// ❌ Avoid - transition all (performance impact)
transition: all 150ms ease;
```

## CSS Organization

- Layer CSS using `@layer` for proper cascade control
- Theme overrides go in `@layer theme-override`
- Component styles in `@layer components`
- Utility styles in `@layer utilities`
