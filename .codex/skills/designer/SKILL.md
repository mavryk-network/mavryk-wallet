---
name: designer
description: Use this when implementing or updating extension UI, improving visual consistency, styling React components, following Figma/design references, or creating reusable design building blocks in the Mavryk Wallet app. Prefer Tailwind utilities and theme tokens from `tailwind.config.js`, and use CSS Modules only when utility classes are not a good fit.
---

# Purpose

Use this skill when:

- building new UI screens or components
- improving existing design without explicit mockups
- aligning pages or components with the existing wallet visual system
- implementing styles from MCP, Figma, or design links
- creating reusable UI wrappers or shared visual components

# Project UI context

- This repo is Tailwind-first, not CSS-Modules-first.
- Use `tailwind.config.js` as the source of truth for colors, spacing, border radius, shadows, typography, widths, and breakpoints.
- Use `src/main.css` for shared global utilities, resets, keyframes, and third-party overrides that must stay global.
- Match the current wallet visual language instead of introducing a new one. Common tokens already used across the app include `bg-primary-card`, `bg-primary-bg`, `text-cleanWhite`, `text-secondary-white`, `border-divider`, and `text-accent-blue`.
- Reuse existing class helpers:
  - `clsx` for simple conditional classes
  - `merge` from `src/lib/utils/merge.ts` when combining Tailwind classes from props or override paths

# Design rules

- If the task includes a design link or MCP reference, follow that design as the source of truth, but map it onto existing repo primitives and theme tokens instead of hardcoding a separate style system.
- If no design is provided, keep the result consistent with the current wallet UI rather than defaulting to a generic external design language.
- Reuse existing Tailwind tokens before adding new colors, spacing, sizes, or breakpoints.
- Prefer project utilities and theme classes over raw values.
- Preserve current responsive behavior, especially popup vs full-page layouts and the custom breakpoints in `tailwind.config.js` such as `xxs`, `xxsPlus`, `xs`, and `sm`.
- Avoid inline styles unless the value is truly dynamic at runtime or cannot be expressed cleanly with existing utilities. If a static value repeats, move it into Tailwind config or shared styles.

# Component reuse rules

- Before creating new UI, inspect nearby `pages/`, `templates/`, `layouts/`, `molecules/`, `atoms/`, `compound/`, and `lib/ui/` code.
- Reuse existing wrappers, shells, form controls, cards, dropdowns, banners, and modal/page layouts whenever possible.
- If a reusable component is missing, place it in the existing project layer that matches its responsibility:
  - `atoms/` for small primitives
  - `molecules/` for small composed UI pieces
  - `compound/` for reusable interactive controls
  - `templates/` for reusable feature sections or flows
  - `layouts/` for page shells and structural wrappers
  - `lib/ui/` for shared UI helpers/components that must be reusable outside `app/`
- Do not add an `organisms/` layer. This repo does not use it.
- Do not duplicate components if a small extension of an existing one is enough.

# Styling rules

- Prefer Tailwind utility classes in TSX by default.
- Use CSS Modules only when one of these applies:
  - complex pseudo-elements or selectors
  - keyframes or animations that are not already covered by `src/main.css` or Tailwind config
  - third-party library overrides
  - visual state logic that becomes unreadable as long utility strings
- When CSS Modules are needed, keep them local and minimal. Use them to complement Tailwind, not to replace it wholesale.
- When new reusable design tokens are needed, extend `tailwind.config.js` first. Only use `src/main.css` for global utilities or styles that must be global.
- Keep hover, focus, disabled, selected, and loading states explicit and visually consistent with nearby screens.
- Prefer semantic token classes over raw hex values. If a local component already uses inline dynamic colors, keep the hardcoded styling contained instead of spreading that pattern further.

# Implementation approach

1. Check whether a design reference or similar existing screen already exists.
2. Inspect nearby shared UI and layout components before creating anything new.
3. Implement with Tailwind utilities first, using tokens from `tailwind.config.js`.
4. Use `clsx` or `merge` consistently with surrounding code.
5. Reach for CSS Modules only if Tailwind stops being clear or cannot express the styling cleanly.
6. Keep business logic out of render-heavy UI and move orchestration into hooks when needed.
7. Verify the result works in both popup and full-page contexts when the screen supports both.

# Output expectations

- UI should look consistent with the wallet, not generic.
- Components should be reusable where it makes sense.
- Styling should be token-driven, readable, and maintainable.
- Shared theme tokens should be respected and extended only when necessary.
