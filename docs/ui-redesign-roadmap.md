# LarchMont OS — UI Redesign Roadmap

> Direction from the user on 2026-04-11:
> — Everything should feel **bigger, more minimal, and more Anytype-like**.
> — Sidebar should be **read-only navigation** (no new-page creation from it).
> — Chrome should **single-click collapse** (no rail intermediate).
> — **Favorites/pinning** should actually work and not be duplicated.
> — Dashboard should be the reference for minimalism — replicate its restraint everywhere.
> — Creative Studio icons need to be bigger, toolbar tooltips stay.
> — Animations should match Anytype's smoothness.
> — Screenshot reference was a macOS temp path, not accessible from this environment.

This document is the full A→Z plan. **Phase 1** items marked ✅ have already shipped in this session.

---

## Phase 1 — Shipped in this session

### Sidebar toggle: single-click collapse ✅
- `lib/store.ts` — `cycleSidebarMode` now cycles **full ↔ hidden** only. The `rail` mode still exists as a type target for legacy direct-set callers, but is never reachable from the toggle button.
- Effect: clicking the PanelLeft icon in the top chrome fully hides the sidebar on first press, re-opens it on second. No more 3-state fidgeting.

### Top chrome cleanup ✅
- `components/layout/top-chrome.tsx`
  - ❌ Removed: **Globe** (Network), **History**, **Menu** icons from the left cluster.
  - ✅ Star button is now **functional** — writes to a new persistent `useFavoritesStore` and renders filled when the current route is pinned. Label reads "Pin to sidebar" / "Unpin from sidebar".
  - ✅ `SIDEBAR_MODE_LABELS` updated to reflect the 2-state toggle.

### Page-header dedupe ✅
- `components/shared/page-header.tsx`
  - ❌ Removed: **Sliders** (Customize view), **Star**, **More** — all were duplicates of Top Chrome or non-functional.
  - ❌ Removed: `description` rendering — the "Good morning —" subhead is gone.
  - Title, back/forward, and action-slot passthrough preserved.
- `app/dashboard/page.tsx` — no longer passes the `description` prop to `PageHeader`.

### Favorites store ✅
- `lib/favorites-store.ts` — new Zustand store persisted to `localStorage` key `larchmont:favorites`.
- `components/layout/app-hydration.tsx` — hydrates favorites on mount alongside theme + pages.
- Sidebar "Pinned" section now renders live from this store, with an unpin button (✕) on row hover.

### Sidebar is read-only ✅
- `components/layout/sidebar.tsx`
  - ❌ Removed: all "New page" affordances — the Plus action row, the `+` trailing button on "My Pages", and the Plus button in rail mode.
  - ❌ Removed: `handleCreatePage` handler and `useRouter` import (unused after removal).
  - ✅ "Pinned" section renders from `useFavoritesStore` with hover-to-unpin.
  - Custom Pages are still editable and deletable from within their own editors; they just can't be created from the sidebar.

### Size bumps (sidebar) ✅
- Section labels: `10.5px → 11.5px`, chevrons `10 → 12`.
- Action row: `h-8 → h-9`, icon `13 → 15`, text `13 → 13.5`, icon tile `16 → 18`.
- Object row: `h-7 → h-9`, icon tile `14×14 → 20×20`, icon `9px → 13px` (strokeWidth `2.5 → 2.3`), text `12.5 → 13.5`.
- Custom page row: same bumps.
- Transition duration: `100ms → 150ms` on all hover states for a calmer feel.

### Size bumps (Creative Studio) ✅
- Toolbar (`Toolbar.tsx`):
  - Button `h-9 w-9 → h-11 w-11`, gap `1 → 1.5`, radius `rounded → rounded-lg`, padding `p-1 → p-1.5 rounded-xl`.
  - Icon `16 → 20`, strokeWidth 2.
  - Added scale-on-active (`1.02`) and scale-on-hover (`1.04`) with a `150ms ease-out` transition.
- Block wrapper (`BlockWrapper.tsx`):
  - Connector anchor dots `2.5×2.5 → 3.5×3.5`, border `1 → 2`, added `transition-all duration-150 ease-out`.
  - Drag handle strip `h-3 → h-4`, added `transition-opacity`.
  - Resize handle `3×3 → 4×4`, added `transition-opacity`.
  - Lock icon `10 → 12`.

### Page-header icon bump ✅
- Route icon tile `18×18 → 20×20`, inner icon `11 → 13` (matches the sidebar's new scale).

---

## Phase 2 — Tasteful sweep (next session, needs your approval)

### 2.1 Design tokens

Currently sizes are inlined everywhere (`text-[12.5px]`, `h-[14px]`, `size={9}`, etc.). This is why resizing meant touching 10+ files. Fix:

- Add `app/globals.css` CSS custom properties:
  ```css
  :root {
    --fs-xs: 11px;    --fs-sm: 12.5px;  --fs-base: 13.5px;  --fs-lg: 15px;  --fs-xl: 17px;
    --ic-xs: 12px;    --ic-sm: 14px;    --ic-md: 16px;      --ic-lg: 20px;  --ic-xl: 24px;
    --tile-sm: 16px;  --tile-md: 20px;  --tile-lg: 24px;
    --dur-fast: 150ms; --dur-med: 220ms; --dur-slow: 320ms;
    --ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }
  ```
- Refactor: sweep the codebase replacing magic numbers with these tokens. Changes will touch: sidebar, top-chrome, page-header, creative-studio/*, dashboard cards, kanban, day-hyperplanner, daily-repeatables (which user said are already good — tune to match those values).

**Why it matters:** future size requests become a single-file edit. Consistency across routes.

### 2.2 Animation library (Anytype-style)

Anytype's smoothness comes from:
- **Consistent easing** — everything uses `cubic-bezier(0.25, 0.46, 0.45, 0.94)` or similar. Enforce one.
- **Staggered entrance** — lists animate in with ~20ms per-item offset on mount.
- **Scale-on-press** — buttons subtly shrink to `0.96` on active, bounce back.
- **Sidebar width spring** — currently `0.22s linear`; switch to `spring({ stiffness: 300, damping: 32 })` which reads smoother.
- **Panel mounts** — BoardPopover / SlashMenu / command palette should use the same `opacity + scale 0.96 → 1` curve.
- **Hover reveal timing** — connector anchors and drag handles should fade in at `150ms` (already done in Phase 1). Resize lag introduces Anytype-feel.

**Implementation sketch:**
```ts
// lib/motion.ts
export const EASE = [0.25, 0.46, 0.45, 0.94] as const
export const DUR = { fast: 0.14, med: 0.22, slow: 0.32 }
export const anim = {
  fadeIn: { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: DUR.fast, ease: EASE } },
  slideUp: { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: DUR.med, ease: EASE } },
  scaleIn: { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, transition: { duration: DUR.fast, ease: EASE } },
}
```
Apply across: BoardPopover, SlashMenu, CommandPalette, StatCards (dashboard), Toast, modal overlays.

### 2.3 Dashboard sweep

User said "I like how the dashboard currently is laid out" — so the *layout* is the reference but it can be more restrained:
- Kill the `StatCard` chart mini-previews on mobile breakpoints (they render too tight under 640px).
- Simplify the "Creative Studio" summary card — currently reads out 3 metrics, bring it to 1 big number + subtext.
- Consider: **remove the PageHeader entirely on Dashboard**. Top Chrome already shows "Dashboard", so page-header is pure dead space. Risk: breaks visual rhythm with other routes. Needs your call.

### 2.4 Creative Studio polish

- **Toolbar visual refinement**: current is a vertical pill of 13 buttons. Anytype-style would group them (select/pan as separator, then block types, then connector, then utilities). Add `h-px` divider every 3 items.
- **Tooltip animation**: current instant-show. Add `delay: 400ms` open, `delay: 0ms` close, with `scale 0.96 → 1 + opacity` transition.
- **Canvas zoom controls**: current bottom-right widget is functional but cramped. Make it floating, rounded-full, same visual weight as the toolbar.
- **Slash menu**: size bump (15px items, 13px descriptions), add category headers (Format / Insert / Style).
- **Block hover**: on block hover, show a floating mini-toolbar at the top-right (duplicate/lock/delete). Currently locked behind context menu only.
- **Selection ring**: currently `ring-2`. Bump to `ring-[3px]` with `ring-offset-1` for prominence.

### 2.5 Sidebar additions

- **Sticky header z-index fix**: When sidebar scrolls, the Workspace header should stay pinned at the top of the sidebar (currently it scrolls away on short viewports).
- **Section drag-to-reorder**: Allow user to reorder Pinned ↔ My Pages ↔ Objects.
- **Keyboard navigation**: `↑/↓` to move through rows when focus is in sidebar, Enter to navigate.
- **Inbox unread badge**: currently a plain pill — make it match the object-row icon-tile scale so it doesn't look bolted-on.

### 2.6 Search / command palette

Currently `⌘K` opens a command palette (`components/shared/*` — not yet inspected). Needed:
- **Unified search** across: routes, custom pages, Creative Studio boards, tasks, projects. Currently only routes.
- **Recent** section at the top.
- **Quick actions** section: "New task", "New board", "New page" (since those are removed from sidebar, they live here).
- **Preview on hover** — selected result shows a 1-line preview on the right.

### 2.7 Top chrome refinement

- The center cluster (icon + title) should become **clickable** — opens a dropdown with route metadata (last modified, created by, archive, pin/unpin) similar to how Anytype's page title works.
- More menu (top right) is currently empty — wire it to: duplicate, archive, rename, export.

### 2.8 Dead code sweep

Now that `rail` mode is unreachable from the toggle button, the rail-mode render branch in `sidebar.tsx` is dead code behind a direct-set path. Decide:
- **Option A**: Delete rail mode entirely. `SidebarMode` becomes `'full' | 'hidden'`. Cleaner type.
- **Option B**: Keep rail as an optional "compact desktop" state, surface it behind a secondary toggle (cmd-click the PanelLeft?). Preserves the work.

Recommend A unless you specifically want compact rail as a separate mode.

---

## Phase 3 — Bigger systemic work (future)

### 3.1 Responsive system
The app currently feels desktop-first with awkward mobile breakpoints. Systematic pass:
- Sidebar becomes a **drawer** under 768px.
- Top Chrome hides object title on mobile.
- Dashboard cards become 1-col under 640px.
- Creative Studio locks to a read-only panel under 1024px.

### 3.2 Theme system beyond accent
The ThemeStore only manages the accent color. Expand to:
- Dark ↔ Light mode toggle (currently hardcoded to dark-ish via `:root` vars).
- Surface density: Compact / Regular / Comfortable.
- Font choice: Inter / Söhne / JetBrains (for mono blocks).

### 3.3 Block library expansion (Creative Studio)
- **Calendar block** — week/month grid tied to events
- **Table block** — database-lite, syncs to projects/tasks
- **Code block** — monaco or codemirror
- **Kanban block** — draggable columns on canvas
- **Embed block v2** — richer preview (OpenGraph scrape)

### 3.4 Data persistence for Creative Studio
Currently `localStorage`-only. Migrate boards/blocks to Supabase so they survive across devices.

### 3.5 Undo-redo coverage
Creative Studio has undo-redo (`useUndoRedo`). Other mutations (task status, project rename, delete page) don't. Unify under a single history store.

---

## Things I did NOT touch (need your explicit approval)

- **Search/command palette implementation** (2.6) — scope-ambiguous, don't know if you want me to start from scratch or enhance.
- **PageHeader removal from Dashboard** (2.3) — would kill the current back/forward arrow on that route.
- **Rail mode deletion** (2.8) — conservative change that I'd rather confirm before deleting.
- **Dashboard "Creative Studio" summary card rewrite** (2.3) — I don't know which metric you'd want as the "one big number".
- **Mobile breakpoints** (3.1) — you haven't mentioned mobile as a priority yet.
- **Supabase migration for boards** (3.4) — big undertaking, wait for go signal.

---

## Open questions

1. **Rail mode**: kill entirely (option A) or preserve as optional 3rd state (option B)?
2. **PageHeader on Dashboard**: remove since TopChrome duplicates it?
3. **Favorites ordering**: currently append-order. Want drag-to-reorder or alphabetical?
4. **Star on non-route pages**: if you're in `/pages/abc` (a Custom Page), should the star pin that specific page, or the `/pages` parent?
5. **Animation philosophy**: "smooth and calm" (longer durations, softer easing) or "snappy and responsive" (shorter durations, sharper easing)? Phase 1 leaned calm at `150–220ms`.

---

## Files touched in Phase 1

```
NEW  lib/favorites-store.ts
NEW  docs/ui-redesign-roadmap.md
MOD  lib/store.ts                                  (sidebar cycle logic)
MOD  components/layout/app-hydration.tsx           (hydrate favorites)
MOD  components/layout/top-chrome.tsx              (remove Globe/History/Menu, wire star)
MOD  components/layout/sidebar.tsx                 (remove add-page, bigger icons, Pinned section)
MOD  components/shared/page-header.tsx             (remove Sliders/Star/More/description)
MOD  app/dashboard/page.tsx                        (remove good morning)
MOD  components/creative-studio/Toolbar.tsx        (bigger buttons + icons + scale-on-hover)
MOD  components/creative-studio/BlockWrapper.tsx   (bigger anchors/handles + transitions)
```

---

*Document generated 2026-04-11. Update as Phase 2/3 work lands.*
