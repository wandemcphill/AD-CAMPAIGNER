# FlipTrybe Design System Summary

## Visual Identity

### Color Palette

```
PRIMARY (Action/CTA)
┌─────────────────────┐
│ Orange #FF9500      │  Growth, warmth, Nigerian market
│ Hover: #EA8C00      │  trusted, action-oriented
└─────────────────────┘

SEMANTIC COLORS
┌─────────────────────┐
│ ✓ Success #10B981   │  Active, conversions, positive
│ ⚠ Warning #F59E0B   │  At-risk, caution, review
│ ✗ Error #EF4444     │  Failed, declined, urgent
│ ℹ Info #3B82F6      │  Tips, notifications, guidance
└─────────────────────┘

NEUTRAL (Hierarchy)
┌─────────────────────┐
│ Slate-900 #0F172A   │  Headings (primary action)
│ Slate-700 #334155   │  Body text (readable)
│ Slate-500 #64748B   │  Secondary text (hint)
│ Slate-200 #E2E8F0   │  Borders, dividers
│ Slate-50 #F8FAFC    │  Backgrounds, subtle fills
└─────────────────────┘
```

### Typography Scale

```
H1  32px Bold     "Create Campaign" (page titles)
H2  24px Semibold "Campaign Performance" (sections)
H3  18px Semibold "Budget Progress" (subsections)
    
Body-L  14px Regular "Normal text" (paragraph)
Body-S  13px Regular "Secondary text" (descriptions)
Label   11px Medium  "Status" "Platform" (labels)
```

### Spacing System (8px base)

```
xs   4px    (gaps in condensed layouts)
sm   8px    (component internal spacing)
md   16px   (section padding)
lg   24px   (section margin)
xl   32px   (page margin)
2xl  48px   (between major sections)
```

---

## Component Library Overview

### Atoms (Micro Components)

```
Button
├─ Primary (Orange, default CTA)
├─ Secondary (Outline, alternative)
├─ Danger (Red, destructive action)
└─ Ghost (Minimal, text-only)

States: Default | Hover | Active | Disabled | Loading

Badge
├─ Solid (Status: Active, Paused)
├─ Outline (Tags, secondary info)
└─ Dot (Live indicator)

Input
├─ Text (Campaign name, text fields)
├─ Number (Budget, quantity)
├─ Select (Dropdown, single choice)
├─ Textarea (Description)
└─ Search (Filter, lookup)

Icon
├─ Heroicons (24 main icons)
├─ Color variations (Orange, Success, Warning, Error)
└─ Sizes (16px, 20px, 24px)
```

### Molecules (Combinations)

```
Card
├─ Header (Title + Icon)
├─ Content (Information)
└─ Footer (Actions)

FormGroup
├─ Label
├─ Input/Select
├─ Help text
└─ Error message

Alert / Toast
├─ Success (✓ Green)
├─ Error (✗ Red)
├─ Warning (⚠ Amber)
└─ Info (ℹ Blue)

MetricDisplay
├─ Value (large number)
├─ Label (metric name)
├─ Trend (↑↓ indicator)
└─ Target (comparison)
```

### Organisms (Complex Sections)

```
Dashboard
├─ Hero (Summary metrics)
├─ FilterBar (Smart filters)
├─ CampaignGrid (Card list)
└─ Pagination

CampaignWizard
├─ StepIndicator (Progress)
├─ FormStep (Input form)
├─ Navigation (Back/Next)
└─ Preview (Reality check)

PerformanceChart
├─ TimeRangeSelector
├─ LineChart (Trends)
├─ MetricsTable (Details)
└─ Legend (Categories)

Sidebar
├─ Logo & Branding
├─ Navigation (7 main sections)
├─ Submenu (Expandable)
└─ Footer (Help, Support)
```

---

## Layout Patterns

### Desktop (> 768px)

```
┌────────────────────────────────────┐
│         Header (Fixed)             │
├─────────┬────────────────────────────┤
│         │                            │
│ Sidebar │     Main Content           │
│ (264px) │                            │
│         ├────────────────────────────┤
│         │  Dashboard / Campaigns     │
│         │  - Hero Section            │
│         │  - Filter Bar              │
│         │  - Campaign Grid           │
│         │                            │
└─────────┴────────────────────────────┘
```

### Mobile (< 768px)

```
┌──────────────────────┐
│  ☰  Logo  Account    │  (Fixed Header)
├──────────────────────┤
│                      │
│  Main Content        │
│  (Full width)        │
│                      │
│  - Hero Section      │
│  - Campaign List     │
│                      │
│                      │
├──────────────────────┤
│  Sidebar             │  (Slide-out overlay)
│  (264px)             │
└──────────────────────┘
```

---

## Interaction Patterns

### Loading States
```
Type 1: Skeleton (Page Load)
┌──────────────┐
│ ░░░░░░░░░░░░ │  Animated gray bars
│ ░░░░░░░░     │  showing layout
│ ░░░░░░░░░░░░ │
└──────────────┘

Type 2: Spinner (Action)
[Spinner] Creating campaign...

Type 3: Progress Bar
Progress: ████████░░ 82% (8,200 / 10,000 views)
```

### Transitions
```
Fade-in       300ms (new content appears)
Slide-up      300ms (modals, notifications)
Bounce        400ms (emphasis, success)
Ease-out      200ms (interaction feedback)
```

### Feedback Toast

```
✓ Campaign created successfully    [Dismiss]
```

Auto-dismiss after 4s, user can dismiss early

### Modal Dialog

```
┌────────────────────────────┐
│ ⚠ Pause Campaign?          │
├────────────────────────────┤
│ This will stop ad delivery  │
│ immediately.               │
│                            │
│ [Cancel] [Pause Campaign]  │
└────────────────────────────┘
```

---

## Dark Mode Strategy

### Approach: CSS Variables + System Preference

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0F172A;        /* Slate-900 */
    --color-surface: #1E293B;   /* Slate-800 */
    --color-text: #F8FAFC;      /* Slate-50 */
    --color-text-secondary: #CBD5E1;
    --color-border: #334155;
  }
}
```

### Dark Mode Palette

| Element | Light | Dark |
|---------|-------|------|
| Background | Slate-50 | Slate-900 |
| Surfaces (Card) | White | Slate-800 |
| Text (Primary) | Slate-900 | Slate-50 |
| Text (Secondary) | Slate-500 | Slate-400 |
| Borders | Slate-200 | Slate-700 |
| Orange (CTA) | #FF9500 | #FFA500 |

---

## Accessibility Standards (WCAG 2.1 AA)

### Color Contrast Ratios
```
Text on Background
┌─────────────────────────────┐
│ Body text (14px): 4.5:1     │
│ Large text (18px): 3:1      │
│ UI elements: 3:1            │
└─────────────────────────────┘
```

### Interactive Elements
```
Keyboard Navigation
✓ Tab through interactive elements
✓ Focus indicators (2px orange outline)
✓ Arrow keys for menus

Screen Readers
✓ ARIA labels on icons
✓ Form labels associated with inputs
✓ Status updates announced
✓ Focus management in modals
```

### Examples

```tsx
// Icon with label
<button aria-label="Close modal">
  <XIcon />
</button>

// Form with error
<input
  aria-invalid={hasError}
  aria-describedby={hasError ? "error-msg" : undefined}
/>
{hasError && <div id="error-msg">Required field</div>}

// Live region (status updates)
<div aria-live="polite" role="status">
  Campaign created successfully
</div>
```

---

## Performance Targets

### Bundle Size
```
CSS:    < 30 KB (minified)
JS:     < 150 KB (minified)
Icons:  < 50 KB (SVG sprite)

Total Initial Load: < 230 KB
```

### Load Times
```
First Contentful Paint (FCP): < 1.5s
Largest Contentful Paint (LCP): < 2.5s
Cumulative Layout Shift (CLS): < 0.1
```

### Interactive Elements
```
Button click → feedback: < 50ms
Page transition: < 300ms
Chart rendering: < 1s
```

---

## Brand Voice & Copy

### Tone
- **Confident**: "We've got this"
- **Helpful**: Guidance without judgment
- **Clear**: No jargon, direct language
- **Warm**: Conversational, human

### Microcopy Examples

```
Error State (Current)
❌ Something went wrong

Error State (Better)
❌ Your card was declined
   Try another card or contact support.

Empty State (Current)
No campaigns yet

Empty State (Better)
🚀 Ready to launch your first campaign?
   [Create Campaign]

Success (Current)
Success

Success (Better)
✓ Campaign "Coffee Shop Launch" created
  It will start reaching people tomorrow.
```

---

## Responsive Breakpoints

```
Mobile    < 640px   (phones)
Tablet    640-1024px
Desktop   > 1024px
```

### Responsive Adjustments

```
Mobile:
├─ 1-column layout (full width)
├─ Sidebar → drawer/overlay
├─ Cards → simplified
└─ Hero stats → stacked

Tablet:
├─ 2-column layout
├─ Sidebar visible (smaller)
└─ Cards → side-by-side pairs

Desktop:
├─ 3+ column layout
├─ Sidebar (264px fixed)
└─ Cards → grid display
```

---

## Implementation Timeline

### Week 1: Foundation
- [ ] Install Shadcn/UI
- [ ] Set up Storybook
- [ ] Create design tokens (colors, spacing, typography)
- [ ] Build atomic components (Button, Badge, Input, Icon)

### Week 2: Molecules
- [ ] Build Card, Alert, Toast, MetricDisplay
- [ ] Create FormGroup with validation styling
- [ ] Set up modal base component

### Week 3: Organisms & Pages
- [ ] DashboardHero component
- [ ] CampaignCard redesign
- [ ] CampaignFilterBar
- [ ] Sidebar navigation

### Week 4: Advanced Flows
- [ ] CampaignWizard (multi-step form)
- [ ] PerformanceChart (analytics)
- [ ] WalletCard + Transaction history

### Week 5-6: Refinement
- [ ] Mobile responsiveness testing
- [ ] Dark mode implementation
- [ ] Accessibility audit
- [ ] Performance optimization

### Week 7-8: Polish & Docs
- [ ] Micro-interactions (animations)
- [ ] Error handling & edge cases
- [ ] Component library documentation
- [ ] Designer handoff guide

---

## Design Tools & Resources

### Recommended Stack
```
Design:     Figma (collaboration, components)
Dev:        Storybook (documentation, testing)
Icons:      Heroicons (open-source, consistent)
Components: Shadcn/UI (headless, customizable)
Styling:    Tailwind CSS (utility-first, fast)
```

### Design References
- Meta Ads Manager (structure, analytics)
- Google Ads (simplicity, clarity)
- HubSpot (growth metrics, smart defaults)
- Stripe (trust, professionalism)
- Canva (delight, onboarding)
- Figma (modern, sophisticated)

### Documentation
```
docs/
├─ UI_UX_DESIGN_RECOMMENDATIONS.md
├─ UI_IMPLEMENTATION_GUIDE.md
├─ DESIGN_SYSTEM_SUMMARY.md (this file)
├─ ACCESSIBILITY_GUIDELINES.md
└─ MIGRATION_CHECKLIST.md
```

---

## Success Metrics

### User Experience
- Time to create campaign: 8 min → 3 min
- Campaign completion rate: 60% → 85%
- Mobile usage: 0% → 40%
- Support tickets (UI confusion): -40%

### Business Metrics
- User satisfaction (NPS): ? → 50+
- Feature adoption (new flows): 0% → 70%
- Retention (30-day): ? → 65%+

### Technical Metrics
- Lighthouse score: ? → 90+
- Bundle size: ? → < 230 KB
- Time to interactive: ? → < 2.5s

---

## Questions & Support

For questions on implementation:
1. Check Storybook documentation first
2. Review component examples in UI_IMPLEMENTATION_GUIDE.md
3. Reference design tokens in this document
4. Test with users early and often

