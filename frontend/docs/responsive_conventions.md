# Responsive & Styling Conventions

This project follows a strict, unified approach to responsive design and styling, based on Tailwind CSS v4.

## Single Source of Truth
Tailwind CSS is the sole authority for responsive breakpoints and design tokens. 

### Breakpoints (Mobile-First)
- **Base (default)**: `360px - 639px` (Mobile)
- **`sm`**: `>= 640px` (Large phones)
- **`md`**: `>= 768px` (Tablet portrait)
  - *Note: This is the boundary for off-canvas drawer vs side-by-side Sidebar.*
- **`lg`**: `>= 1024px` (Tablet landscape / Small desktop)
  - *Note: Sidebar defaults to collapsed (`68px`) on `md`, and expands (`220px`) on `lg`.*
- **`xl`**: `>= 1280px` (Desktop)
- **`2xl`**: `>= 1536px` (Large Desktop)

### Styling Rules
1. **Prefer Tailwind Utilities**: Use Tailwind for all layouts, grids, flexbox, typography, and responsive adjustments.
2. **CSS Modules are for Bespoke Effects**: Use `*.module.css` *only* for:
   - `@keyframes` animations.
   - Highly complex, custom visual effects that cannot be cleanly expressed with Tailwind (e.g. multi-layered radial gradients).
3. **No Media Queries in CSS Modules**: Do NOT write `@media (max-width: ...)` in CSS Modules for layout reflows. Layout reflows must be handled by responsive Tailwind classes (e.g. `flex-col md:flex-row`).
4. **Token Consistency**: Colors, spacing, radii, and fonts are centrally defined in the `@theme` block in `globals.css`. Do not hardcode HEX or RGB values in UI components. Use the theme spacing scale — don't hardcode px margins/paddings.

### Layout & Sizing
- **Fluid Layouts**: No horizontal scroll at any supported width. Never set fixed pixel widths on layout containers — use fluid widths (`%`, `max-w-*`, `min()`, `clamp()`). Fixed px is only for genuinely fixed chrome (68px rail, icons).
- **Constrain Content**: Constrain long-form content to a max width and center it; full-bleed areas span the viewport intentionally.

### Mobile Viewport & Safe Areas
- Use `dvh`/`svh`, NOT `vh`, for full-height layouts (vh breaks under the mobile URL bar). e.g. `min-h-[100dvh]`.
- Respect safe areas with `env(safe-area-inset-*)` for any fixed/bottom UI (bottom sheets, sticky bars, mobile top bar).

### Touch & Interaction
- **Tap Targets**: Minimum interactive target `~44x44px` on touch. 
- **No Hover-Only Affordances**: Every hover action needs a tap/focus equivalent. 
- **Accessibility**: Visible focus on all interactive elements.

### Typography
- **Fluid Type**: Mobile-first, fluid type (`clamp()` or `md:`/`lg:` steps) so headings don't overflow small screens; body stays `>= 16px` on mobile.

### Images & Media
- Use `next/image` with correct sizes and defined aspect ratios to prevent layout shift (CLS). No fixed-width images that overflow small screens.

### Layering (z-index scale)
- Single documented scale: base `0`, sticky header `10`, drawer/overlay `40`, modal `50`, toast `60`. No ad-hoc `z-[9999]`.

### Mobile-First Discipline
- Base styles target the smallest screen; layer up with min-width prefixes (`md:`, `lg:`). Avoid desktop-first `max-*` variants as the default pattern.
- Base applies from 0px up; 360px is just the smallest design target (sanity-check ~320px if you must support it).

### Testing
- Verify every change at: 360 / 390 / 430 (mobile), 768 / 1024 portrait+landscape (tablet), 1280+ (desktop). No overflow, no clipped content, correct sidebar mode at the md/lg boundaries.
