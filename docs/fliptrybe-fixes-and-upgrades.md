# Fliptrybe — Fix & Upgrade Brief for Codex

Context: two apps — client-facing "Campaign Desk" (`fliptrybe-ads-campaigner-web`) and admin "Operations command" console (`fliptrybe-ads-campaigner-admin`). Below are bugs to fix and upgrades to build, in priority order. Each item has a problem statement, expected behavior, and acceptance criteria so Codex can implement and verify without guessing intent.

## Status

| # | Item | Status |
| --- | --- | --- |
| 1 | Auth state shows "SIGNED OUT" | ✅ Resolved (admin app only) |
| 2 | Naira symbol renders as strikethrough "N" | ✅ Resolved |
| 3 | Spend History header truncates to "REFER" | Open |
| 4 | Admin telemetry mismatch (live users, zeroed campaign/payment) | Open |
| 5 | "PARTIAL TELEMETRY" badge has no drill-down | Open |
| 6 | Fee control rows aren't interactive | Open |
| 7 | Redundant zero-state messaging | ✅ Resolved (scope: `/campaigns` only — see note) |
| 8 | "Not now" button behavior undefined | Open |
| 9 | Seed/demo-data toggle | Open |
| 10 | Expand audit trail | Open |
| 11 | Risk severity levels beyond LOW | Open |

---

## 🔴 P0 — Bugs

### 1. Auth state shows "SIGNED OUT" while rendering authenticated views — ✅ Resolved (admin app only)
**Problem:** The sidebar workspace-status pill reads `SIGNED OUT` on every page (Wallet & Billing, My Campaigns, Studio, Reports) even though the user is actively navigating dashboard content that should require auth.
**Investigate:** Whether route guards are failing to check session state before render, or whether this is an intentional "preview shell" for unauthenticated visitors.
**Expected behavior:**
- If unauthenticated: redirect to login before any dashboard data/UI is rendered — no flash of authenticated content, no real numbers exposed.
- If this is an intentional guest-preview mode: the status pill should say something like `PREVIEW MODE` instead of `SIGNED OUT`, to avoid implying a broken session.
**Acceptance criteria:** Confirm with the person which behavior is intended, then implement route guard fix (or copy fix) accordingly. Add a test that hits `/billing`, `/campaigns`, `/reports` while logged out and asserts redirect (or correct preview labeling).

**Resolution (admin app, commit `0ad966d`):** All four admin shells (`AdminCampaignOpsShell`, `AdminDigitalAccessShell`, `AdminGrowthShell`) + root `/` page now check `useApiSession()` on render and redirect unauthenticated visitors to `/login` via `window.location.replace()`, showing no admin UI/nav/session-pill in the interim. Authenticated paths correctly render with "Connected" badge + real content. Verified against real local API and login form.

**Not yet done:** Client-facing app (`/campaigns`, `/billing`, `/reports`) still shows session panel with redirects-after-render behavior instead of pre-render guards. The original problem statement mentions client pages specifically ("Wallet & Billing, My Campaigns, Studio, Reports"), but those have a different architectural pattern (SessionPanel is embedded in CampaignShell which is always rendered) — they avoid the "Signed out" pill contradiction by showing the redirect message only when `!session`, not by pre-rendering locked UI. Admin app took the stricter approach (pre-redirect) which felt safer for privileged surfaces.

### 2. Naira symbol (₦) rendering as strikethrough "N" — ✅ Resolved
**Problem:** Currency values across Wallet & Billing, My Campaigns, and admin Payment Volume render the ₦ glyph incorrectly (appears as struck-through N) in at least one browser/font context.
**Fix:** Check font-family stack for currency-bearing components; ensure a font with full ₦ (U+20A6) glyph coverage is loaded, or fall back to a system font known to support it (e.g., Noto Sans, system-ui with Naira coverage) rather than relying on a custom font that lacks the glyph.
**Acceptance criteria:** ₦ renders correctly across Chrome/Edge/Firefox and mobile webviews; add a visual regression test or snapshot for a currency component.

**Resolution (commit `e104069`):** Imported Noto Sans from Google Fonts and prioritized it at the head of the `--font-display` stack (before DM Sans). Noto Sans has full glyph coverage for U+20A6 (₦), while DM Sans lacks it. Consolidated font-display definitions into `packages/ui/src/themes.css` to avoid duplication and ensure consistent font ordering across both web and admin apps. Font stack now reads: `"Noto Sans", "DM Sans", ui-sans-serif, system-ui, ...`, guaranteeing Naira support without system-font dependencies.

### 3. Table column header truncation in Spend History
**Problem:** In Wallet & Billing → Spend History table, the last column header renders as "REFER" instead of "REFERENCE" (or whatever the full label is).
**Fix:** Either shorten the column label intentionally (e.g., "Ref #") with a tooltip for the full term, or fix the container/overflow CSS so the full label displays. Check responsive breakpoints — this may only clip at certain viewport widths.
**Acceptance criteria:** Header text fully visible at all supported breakpoints down to the app's minimum supported width; no `overflow: hidden`/`text-overflow: ellipsis` silently eating the last column.

---

## 🟠 P1 — Inconsistencies worth resolving

### 4. Admin telemetry mismatch: live user data vs. zeroed campaign/payment data
**Problem:** Admin Overview shows real numbers for `New accounts (842)`, `Suspended (13)`, `Team invites (91)`, but `Payment Volume`, `Fraud Signals`, `Queue Depth`, and all campaign-side metrics read 0 — even though 842 accounts exist.
**Investigate:** Whether this is expected (no one has launched a campaign yet) or a broken join/query between the users table and campaigns/payments telemetry pipeline.
**Acceptance criteria:** Confirm via DB query whether any campaigns/payments actually exist for those 842 accounts. If data exists but isn't surfacing, fix the query/aggregation. If genuinely zero, no code change needed — document as expected state.

### 5. "PARTIAL TELEMETRY" badge has no drill-down
**Problem:** Admin Overview shows a `PARTIAL TELEMETRY` status badge with no way to see which system(s) are degraded.
**Fix:** Make the badge clickable/hoverable, opening a panel or tooltip listing which telemetry sources are down or delayed (e.g., "Payments: delayed 4m", "Campaign queue: OK").
**Acceptance criteria:** Clicking/hovering the badge reveals a breakdown of monitored systems and their individual status; badge only shows "PARTIAL" when at least one sub-system is degraded, with the underlying data available in the same API response used to render `SYSTEMS NOMINAL`.

### 6. Fee control rows ("configured") aren't interactive
**Problem:** Korapay, Paystack, Stripe, and Manual transfer all show a static "configured" label with no visible way to inspect or edit each integration's settings.
**Fix:** Make each row clickable, opening a detail/edit view (API keys masked, webhook status, last successful transaction, toggle enable/disable).
**Acceptance criteria:** Clicking a fee-control row navigates to (or opens a modal with) that provider's config detail; changes are persisted and reflected immediately in the row state (e.g., "configured" → "needs attention" if a key is invalid).

---

## 🟡 P2 — UX polish

### 7. Redundant zero-state messaging — ✅ Resolved on `/campaigns`
**Problem:** "0 active campaigns / ₦0 spend / 0 impressions"-type messaging repeats near-verbatim across the top stat bar, "Your active campaigns" card, and "Performance pulse" card on the same `/campaigns` page.
**Fix:** Consolidate to a single clear empty-state treatment per page section — e.g., top stat bar always shows numeric zeros (compact), but only one card below should carry the friendly "No campaigns yet, start one" copy and CTA; other cards can show a lighter "—" or "No data yet" without repeating full sentences.
**Acceptance criteria:** No page shows more than one full-sentence empty-state explanation for the same underlying "no campaigns" condition.

**Resolution (`apps/web/app/campaigns/page.tsx`, `components.tsx`, commits `0e63ef0` + `02efc75`):**
- `MetricStrip` no longer repeats the active/pending-review counts `SummaryStatStrip` already shows two rows above it — it now carries only the two numbers unique to it (Impressions, Avg CPM).
- "Your active campaigns" keeps the one full-sentence empty state with CTA — the primary explanation.
- "Managed ads desk", "Performance pulse", and "Recent launch window" now show a single-line `InlineEmptyNote` instead of a full `EmptyState` block **specifically when the root cause is "no campaigns yet"** — the same condition already explained above. When campaigns exist but insight/trend data genuinely hasn't populated (a distinct, real condition — not the same as having zero campaigns), those two cards still show their full `EmptyState` with proper copy, since that's worth its own explanation.

Verified against a real empty workspace (all four cards) and a real `DRAFT` campaign (confirms the full `EmptyState` still renders correctly for the distinct "campaigns exist, no insight/trend yet" case), both logged in through the actual auth flow.

**Not yet done:** Billing and other pages weren't audited for the same duplicate-empty-state pattern — this pass covered `/campaigns` only.

**Related work (net-new, not in the original list):** while fixing this, also added a "Needs your attention" panel above the stat strip that surfaces campaigns needing action (`CHANGES_REQUESTED`/`REJECTED`/`FAILED`) and low-wallet-vs-active-spend, linking straight to the fix — replaces the old pattern of next-action text being buried inside individual campaign cards. Also regrouped the desktop sidebar nav (`apps/web/app/campaigns/components.tsx`, `data.ts`, commit `9de17ea`) and added links to `/growth-services`, `/vouchers`, and `/profile`, which were fully built pages with no nav entry point at all before this.

### 8. "Not now" button behavior on Business Profile gate is unclear
**Problem:** On `Start a Campaign`, clicking "Not now" instead of "Complete Business Profile" — unclear what state this leaves the user in (fully bypasses gating? Soft-blocks later? Just dismisses the banner?).
**Fix:** Define and document intended behavior. Recommended: "Not now" dismisses the prompt for the session but re-blocks at actual submission time with a clear inline message ("Business profile required to submit — complete it here").
**Acceptance criteria:** Clicking "Not now" has a defined, tested behavior; user cannot silently submit a campaign brief without a completed business profile if that's a hard requirement.

---

## 🟢 P3 — Upgrades / new functionality

### 9. Seed/demo-data toggle for staging
**Build:** An admin-only toggle (env var or admin console button) that seeds realistic demo campaigns, wallet transactions, and reports so the client-facing app doesn't show all-zero states during demos or QA.
**Acceptance criteria:** Toggle is admin-gated, clearly labeled as demo data (e.g., watermark or banner), and fully reversible (can be cleared without affecting real production data).

### 10. Expand audit trail beyond campaign events
**Problem:** Audit Trail currently only populates after "the first workspace event" (tied to campaigns), so admin logins, config changes, and fee-control edits go unlogged.
**Build:** Extend audit logging to cover: admin login/logout, fee-control changes (item 6 above), user suspension/reinstatement, and role/permission changes.
**Acceptance criteria:** Each of the above actions creates an audit log entry with actor, timestamp, action type, and before/after values where applicable; Audit Trail tab is non-empty from day one in any environment with admin activity.

### 11. Define risk severity levels beyond "LOW"
**Problem:** Risk desk campaign queue only ever shows a `LOW` badge; no visible design for `MEDIUM`/`HIGH` states.
**Build:** Define thresholds for Medium/High risk (e.g., based on fraud signal count, disputed payment volume, flagged campaign content), corresponding badge colors, and an escalation flow (e.g., auto-notify, require manual review) for Medium/High states.
**Acceptance criteria:** Risk desk badge dynamically reflects real severity based on defined thresholds; High severity triggers a visible action requirement (not just a colored label).

---

## Suggested implementation order
1. Item 1 (auth state) — security-adjacent, fix first.
2. Items 2–3 (visual bugs) — quick, low-risk fixes.
3. Item 4 (telemetry mismatch) — investigate before building anything on top of it.
4. Items 5–6 — admin usability.
5. Items 7–8 — client UX polish.
6. Items 9–11 — net-new capability, schedule after the above stabilizes.
