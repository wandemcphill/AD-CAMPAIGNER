# Brand Reconciliation Scope — Marketing vs. App Design Language

Status: **investigation only, not scheduled**. Written in response to an audit flag that the
marketing homepage (`apps/web/app/marketing/*`) and the authenticated Growth OS app
(`apps/web/app/os/*`, via `packages/ui`) use two unrelated visual languages. This doc
records the concrete delta, the likely cause, and options — no redesign has been executed.

## 1. The app's token system (source of truth)

`packages/ui/src/themes.css` defines two themes, `studio` (light, default) and `clay` (dark),
both consumed through `--ft-*` custom properties, plus shared `--radius-*` / `--shadow-*`
scales and two font stacks (`--font-display`: Sora/Noto Sans; `--font-mono`: IBM Plex Mono).

Studio (light, warm, amber accent):
- `--ft-bg-base: #f5f2ee`, `--ft-bg-surface: #fdfbf8`, `--ft-bg-raised: #ffffff`
- `--ft-text-primary: #1a1611`
- `--ft-accent: #d97706` (amber), `--ft-accent-2: #8b5cf6` (violet, secondary only)
- `--ft-green: #16a34a`, `--ft-red: #dc2626`, `--ft-blue: #2563eb`

Clay (dark):
- `--ft-bg-base: #0a0a0b`, `--ft-bg-surface: #151517`
- `--ft-text-primary: #f5f5f7`
- `--ft-accent: #ef9d3c` (amber, brighter)

`apps/web/app/globals.css` imports `themes.css` and sets `font-family: var(--font-display)`
on the body — the font stack is **already shared globally**, including on the marketing
routes, because it's applied above the marketing/app split, not per-surface.

## 2. What marketing actually uses

Marketing does **not** read `--ft-*` tokens at all. It defines its own ad hoc palette inline,
per component, as Tailwind arbitrary-value classes (`bg-[var(--flip-primary)]`,
`bg-[#0B0F19]`, raw `rgba(...)` gradients) with no shared token file:

- Root vars are declared once, inline on the `<main>` element's `style` prop in
  `apps/web/app/marketing/fliptribe-homepage.tsx:135-142`:
  `--flip-primary: #0066FF`, `--flip-accent: #8B5CF6`, `--flip-cyan: #06B6D4`,
  `--flip-emerald: #10B981`, `--flip-surface: #111827`, `--flip-white: #F9FAFB`.
- Base surface is near-black: `bg-[#0B0F19]` / `#050507`, not derived from any `--ft-bg-*`.
- A duplicate, **unused** `designTokens` object also lives in `data.ts:35-42`
  (`background: "#0B0F19"`, `primary: "#0066FF"`, etc.) — grepped with zero consumers. Dead
  code, and a second source of truth for the same values that already drifted out of sync
  with the inline `style` block (the inline block has `--flip-cyan`/`--flip-white`,
  `designTokens` has `cyan`/no white — not literally identical keys).
- The same base gradient (`#0066FF`/`#8B5CF6` on `#050507`→`#0B0F19`) is **also hardcoded
  directly in the root layout**, `apps/web/app/layout.tsx:33`, wrapping `{children}` for
  every route in the app, not just marketing. In practice `/os/*` pages render their own
  opaque surfaces on top of it so it's not visible there, but it means the marketing palette
  currently leaks one level above the marketing/app boundary, into shared layout.

Raw hex/rgba (not going through any CSS var) appears in 12 marketing component files:
`agency-os.tsx`, `ai-optimization.tsx`, `campaign-preview.tsx`, `command-bar.tsx`,
`creation-matrix.tsx`, `creative-engine.tsx`, `final-cta.tsx`, `fliptribe-homepage.tsx`,
`footer.tsx`, `marketplace.tsx`, `navigation.tsx`, `omnichannel-highway.tsx` — roughly 60+
individual occurrences of `#0B0F19`, `#050507`, `#0066FF`, `#8B5CF6`, `rgba(0,102,255,…)`,
`rgba(139,92,246,…)`, `white/[0.03–0.10]` glass overlays, etc.

## 3. Typography and spacing — narrower than the color delta

- **Font**: shared. No marketing file declares its own `font-family`; the global
  `--font-display` (Sora) from `themes.css` applies everywhere, including marketing.
- **Border radius**: not shared. Marketing uses raw arbitrary values (`rounded-[12px]`,
  `rounded-md` off Tailwind defaults) instead of the app's `--radius-sm/md/lg/xl` scale, so
  radii happen to land close by coincidence, not by reference.
- **Shadows/glass effects**: marketing's `white/[0.035]` translucent-glass surfaces and glow
  rings have no equivalent construct in `--ft-*` (studio/clay use solid surfaces + `--shadow-*`,
  not translucency-over-photographic-black). This is a structural difference, not just a
  color-value difference — porting it means redesigning the surface treatment, not swapping
  variable names.

So the honest scope is: **color + surface-treatment delta is real and large; typography is
already unified; spacing/radius is a token-reference issue, not a value mismatch.**

## 4. Accidental drift or intentional brand choice?

No design manifesto, brand guideline, or intentional-separation note exists. Searched
`docs/DESIGN_SYSTEM_SUMMARY.md`, `docs/UI_IMPLEMENTATION_GUIDE.md`,
`docs/UI_UX_DESIGN_RECOMMENDATIONS.md`, and `docs/handbook/10_FRONTEND_SPECIFICATION.md` —
none mention the marketing site or a deliberate "brand surface vs. product surface" split.

Circumstantial evidence points to **drift, not a decision**:
- The unused, out-of-sync `designTokens` object in `data.ts` suggests two people/passes
  touched the palette independently without reconciling.
- The root-layout gradient bleeding one level above the marketing boundary (into
  `layout.tsx`, shared with `/os/*`) looks like marketing was built first, styled as its own
  product, and the app's token system (`studio`/`clay`, which has its own commit history of
  amber-accent refinement) was layered in later without anyone going back to reconcile the
  homepage.
- That said, a near-black, neon-blue/violet SaaS-launch palette is a common and defensible
  *intentional* choice for a public marketing page specifically to look distinct from the
  product UI (this is common industry practice — marketing sites often diverge from app
  chrome deliberately for conversion/brand impact). The investigation can't rule out that the
  original author chose this palette on purpose; it just found no written record of that
  intent, and found enough sloppiness (dead duplicate token object, drifted values, leaked
  gradient in root layout) to suggest at minimum it was never *reconciled*, whatever the
  original intent.

## 5. Options

**(a) Reconcile marketing into the app's `studio` token system.**
Point marketing's near-black scene at the light, warm, amber-accent palette used everywhere
in `/os/*`. Pro: one visual language end-to-end, no separate token surface to maintain,
kills the dead `designTokens` duplication. Con: the entire homepage is art-directed around a
dark, high-contrast, neon-gradient "AI product launch" aesthetic (particle canvas, glass-on-
black cards, glow lines) — none of that reads the same on a warm cream/amber background.
This is not a token swap, it's a redesign of every section's visual treatment.
Rough size: 12 component files + `data.ts` + the root-layout gradient, ~60+ individual color
references, plus the particle-canvas and glass-surface effects would need entirely new
treatments (not just new hex values) to still look intentional in a light theme. Realistically
several days of design + implementation work, not a config change.

**(b) Document marketing as an intentional, separate "brand surface."**
Formalize what already exists: marketing keeps its own dark neon palette as a deliberate
choice distinct from in-product `studio`/`clay`, but adopts a small set of shared foundation
tokens for baseline consistency — `--font-display` (already shared), and optionally
`--radius-*` (swap `rounded-[12px]` for `var(--radius-lg)` etc., a low-risk mechanical
change). Also: delete the dead `designTokens` object in `data.ts`, and move the inline
`--flip-*` var block out of the `style` prop into a small `marketing/flip-theme.css` (or
similar) so there's one visible source of truth instead of an inline object no one will think
to look at. Pro: cheap, low-risk, kills the actual bugs (dead code, drift, leaked gradient in
shared layout) without pretending this is a token-swap problem it isn't. Con: two visual
languages remain by design — needs a real decision-maker sign-off that this is acceptable,
not just default inertia.

**(c) Middle ground — fix the leak, leave the palette.**
Do the smallest safe thing without deciding brand strategy: move the hardcoded gradient out
of the shared `apps/web/app/layout.tsx` (item flagged in §2) so it only wraps marketing
routes, not the whole app, and remove the dead `designTokens` object. This resolves the one
piece of clear accidental leakage into shared code without touching marketing's intentional-
or-not palette at all, leaving the (b)-vs-(a) brand decision fully open for later.

## 6. Recommendation (not a decision — flagging for a human call)

Recommend **(b) + (c) together**: this looks like drift more than a documented decision, but
the actual fix that's safe to make unilaterally is small (dead code removal, moving the root-
layout gradient scoped to marketing, sharing `--radius-*`) — not a full repaint. Full
reconciliation into `studio` (option a) is a legitimate design direction but is a multi-day
redesign with real brand-impact trade-offs (a near-black neon launch page vs. a warm cream
product page are different conversion bets), so it shouldn't be executed as a side effect of
a cleanup pass. Whoever owns brand/marketing should make that call explicitly.

## 7. What this pass did NOT do

No visual changes were made to marketing or the app. This is a scoping document only, per
the investigation's scope constraints (excludes `apps/web/app/admin/*`, `apps/admin`,
settings, `/os/utilities`, `/os/financial-products`, `/os/airtime`, `ThemeToggle`).
