

# Fix Tutorial Mobile Responsiveness

## Problem
The tour overlay popover positioning doesn't account for mobile screen constraints properly. Key issues:
- Popover width (300px) can overflow narrow screens
- The `popoverH` defaults to 180px on first render before the ref measures, causing miscalculated positioning
- Bottom nav elements (the click targets for navigation steps) are at the very bottom of the screen, leaving no room for the popover below them
- No re-measurement after the popover actually renders, so it can appear off-screen
- `scrollIntoView` can shift the page but the highlight rect isn't recalculated after the scroll

## Changes

### File: `src/components/ui/TourOverlay.tsx`

1. **Reduce popover max width on mobile** - Change from `Math.min(300, vw - margin * 2)` to `Math.min(280, vw - 24)` so it always fits within screen bounds with comfortable padding.

2. **Use a two-pass positioning system** - On first render, position the popover invisibly, measure its actual height via the ref, then reposition correctly. This fixes the "popoverH defaults to 180" problem that causes wrong placement.

3. **Fix bottom nav target positioning** - When the highlight is near the bottom of the viewport (bottom nav items), always place the popover above the highlight. Add explicit logic: if `highlight.top + highlight.height > vh - 100`, force position to "top".

4. **Recalculate after scroll** - After `scrollIntoView`, wait for the scroll to settle and recalculate the highlight rect position, since the element may have moved.

5. **Add safe area inset awareness** - Account for mobile safe areas (notch, bottom bar) by using `env(safe-area-inset-bottom)` padding so the popover doesn't hide behind system UI.

6. **Ensure popover never goes off-screen** - After calculating final position, clamp `top` to be between `margin` and `vh - popoverH - margin`, and `left` between `margin` and `vw - popoverW - margin`.

7. **Center-positioned (no target) steps** - For steps with `position: "center"`, ensure the popover is vertically centered accounting for actual measured height, not the 180px default.

### File: `src/hooks/useOnboarding.tsx`

8. **Adjust step positions for bottom nav targets** - Change the `position` for all bottom-nav click steps (`nav-bills`, `nav-owes`, `nav-expenses`, `nav-contacts`) from `"top"` to explicitly `"top"` (already set, but the overlay will now respect this better with the clamping logic).

### File: `src/pages/Bills.tsx`

9. **No changes needed** - The `data-tour` attributes are already correctly placed.

## Technical Summary

| File | Change |
|------|--------|
| `src/components/ui/TourOverlay.tsx` | Two-pass measurement, mobile-safe clamping, reduced width, scroll-aware repositioning |
| `src/hooks/useOnboarding.tsx` | No changes needed (positions already correct) |

No new dependencies required.
