# Authentication & Onboarding Design Guide

## Overview
Complete design specifications for login, signup, password reset, 2FA, and onboarding flows with security-first UX patterns.

---

## 1. Login Page (Existing Users)

### Visual Hierarchy
```
┌─────────────────────────────────┐
│     FlipTrybe Logo (Left)       │
│                                 │
│  Welcome back to FlipTrybe       │
│  Sign in to manage campaigns    │
│                                 │
│  [Email Input]                  │
│  [Password Input]               │
│  [Remember me] [Forgot?]        │
│  [Sign In Button] (Primary)     │
│                                 │
│  Don't have an account?         │
│  [Create account →]             │
└─────────────────────────────────┘
```

### Layout
- **Split screen** (desktop): Logo + branding (left 40%), form (right 60%)
- **Mobile**: Full-width form with logo centered at top
- **Max-width**: 1200px container, form itself 400px

### Form Fields

#### Email Input
```
Label: Email address
Placeholder: you@company.com
Validation: 
  ✓ Real-time format check (no error until blur)
  ✓ Show error if undeliverable (based on DNS)
  ✓ Case-insensitive, trim whitespace
```

#### Password Input
```
Label: Password
Type: password (toggle visibility icon on right)
Validation:
  ✓ Show/hide toggle (eye icon)
  ✓ "Forgot password?" link always visible
  ✓ No character requirements shown (not annoying)
Error cases:
  ✗ "Email or password incorrect" (never reveal which)
  ✗ "Account locked after 5 failed attempts"
  ✗ "Try again in 15 minutes"
```

#### Remember Me
```
Checkbox: "Keep me signed in for 30 days"
Storage: Secure HTTP-only cookie
Risk: Only show on personal devices
Guidance: "Don't use on shared computers"
```

### States

**Loading State**
```
Button: [Signing in...] (disabled, spinner)
```

**Error State**
```
Alert Box (Red #EF4444):
  Icon: ✗
  Message: Email or password incorrect
  Action: [Retry] (focuses email field)
```

**Success State**
```
Transition: Fade to dashboard
No modal/toast needed (user redirected)
```

**Locked Account**
```
Alert Box (Amber #F59E0B):
  Icon: ⚠️
  Message: Account locked after 5 failed attempts
  Sub: Try again in 15 minutes or [reset password]
```

### Mobile Considerations
- Full-width form, comfortable padding (16px)
- Logo smaller (40px) at top center
- Touch-friendly buttons (48px min height)
- No auto-capitalization on email
- Keyboard type: email
- No autofill obstructing labels

---

## 2. Signup / Registration Flow (4 Steps)

### Architecture: Multi-Step Form
```
Step 1: Email & Password (30%)
  └─ Email
  └─ Password
  └─ Confirm password

Step 2: Account Details (60%)
  └─ Full Name
  └─ Business Name
  └─ Country
  └─ Phone

Step 3: Workspace Setup (90%)
  └─ Workspace Name
  └─ Business Category (dropdown)
  └─ Team Size

Step 4: Verification (100%)
  └─ Email verification link sent
  └─ Await confirmation
```

### Step 1: Create Credentials

```
┌─────────────────────────────────┐
│ Create your FlipTrybe account   │
│ Step 1 of 4 - Credentials       │
├─────────────────────────────────┤
│                                 │
│ Progress: ████░░░░░░ 25%       │
│                                 │
│ Email address                   │
│ [you@company.com]               │
│                                 │
│ Password                        │
│ [••••••••] [show]              │
│ ✓ At least 12 characters       │
│ ✓ Mix of letters & numbers     │
│                                 │
│ Confirm password                │
│ [••••••••]                      │
│ ✓ Passwords match              │
│                                 │
│ [Cancel] [Next: Details →]      │
└─────────────────────────────────┘
```

**Password Requirements (Progressive Disclosure)**
```
Show real-time checklist:
  ☐ At least 12 characters
  ☐ Mix of letters and numbers
  ☐ At least one special character (!@#$%^&*)

Only block submit when all ✓
No "strength meter" (confuses users)
```

### Step 2: Account Details

```
Full Name: [First Last]
Business Name: [Company Name]
Country: [Dropdown - pre-select based on IP]
Phone: [+234 801 234 5678]

Guidance text:
"Help us personalize your experience and assist with support"
```

**Smart Defaults**
```
Country: Detect from IP (Nigeria 🇳🇬?)
  [Allow] [Change]
Phone: Format auto-corrects to E.164 (+234...)
Business Name: Suggest based on email domain if possible
```

### Step 3: Workspace Setup

```
Workspace Name: [My Ad Campaigns]
Guidance: "Your team will use this to organize work"

Business Category:
  ☐ E-commerce
  ☐ Digital Marketing Agency
  ☐ SMM/Growth Services
  ☐ Local Business
  ☐ Creator/Influencer
  ☐ Other

Team Size:
  ☐ Just me
  ☐ 2-5 people
  ☐ 6-20 people
  ☐ 20+ people
```

### Step 4: Email Verification

```
┌─────────────────────────────────┐
│ Verify your email               │
│ Step 4 of 4 - Verification      │
├─────────────────────────────────┤
│                                 │
│ ✓ Account created!             │
│                                 │
│ We sent a verification link to: │
│ you@company.com                 │
│                                 │
│ [Open email client →]           │
│                                 │
│ Didn't receive it?              │
│ [Resend link] (wait 60s)       │
│                                 │
│ Skip for now →                  │
│ (can verify later)              │
│                                 │
└─────────────────────────────────┘
```

### Error Handling

**Email Already Exists**
```
Alert (Amber):
  This email is already registered
  [Sign in instead] or [Use different email]
```

**Weak Password**
```
Inline feedback (not blocking):
  ⚠️ Too short — use at least 12 characters
```

**Network Error**
```
Alert (Red):
  Couldn't create account. Check your connection.
  [Try again] [Save progress] (auto-save draft)
```

---

## 3. Password Reset Flow

### Forgot Password Page

```
┌─────────────────────────────────┐
│ Reset your password             │
├─────────────────────────────────┤
│                                 │
│ Enter the email address tied    │
│ to your account. We'll send a   │
│ link to reset your password.    │
│                                 │
│ Email: [you@company.com]        │
│                                 │
│ [Send reset link]               │
│                                 │
│ [Back to sign in]               │
└─────────────────────────────────┘
```

### After Submit

**Success Screen (No Email Spoofing)**
```
✓ Check your email

We sent a reset link to the email
on file. It expires in 1 hour.

[Didn't get it? Resend] (wait 60s)
[Back to sign in]

Note: Always show success even if
email doesn't exist (security best practice)
```

### Reset Password Link (Emailed)

When user clicks link in email:

```
┌─────────────────────────────────┐
│ Create new password             │
├─────────────────────────────────┤
│                                 │
│ New password                    │
│ [••••••••]                      │
│                                 │
│ Confirm password                │
│ [••••••••]                      │
│                                 │
│ [Reset password]                │
│                                 │
└─────────────────────────────────┘
```

**After Reset**
```
✓ Password updated successfully

You can now sign in with your
new password.

[Sign in now →]
```

**Token Expired**
```
⚠️ Reset link expired

Links expire after 1 hour for security.

[Request new reset link →]
```

---

## 4. Two-Factor Authentication (2FA)

### Setup Flow (First Time)

**Step 1: Choose Method**
```
Two-Factor Authentication

Choose your 2FA method:

○ Authenticator app (TOTP)
  ✓ More secure, works offline
  ✓ Works with Google Authenticator, Authy

○ SMS codes
  ✓ Codes sent to your phone
  ✓ No app needed

○ Backup codes
  ✓ Emergency codes stored somewhere safe
  ✓ Use if you lose access to 2FA method

[Continue →]
```

**Step 2: Setup Authenticator App**
```
Set up authenticator app

1. Download an authenticator app
   [Google Authenticator] [Authy] [Microsoft Authenticator]

2. Scan this QR code
   ┌─────────────┐
   │  [QR CODE]  │  ← (scannable)
   └─────────────┘
   
   Or enter this key manually:
   JBSWY3DPEBLW64TMMQ======

3. Enter the 6-digit code from your app
   [______]
   
   [Verify & enable 2FA]
```

**Step 3: Backup Codes**
```
Save these backup codes

Keep these in a safe place. You can use them
if you lose access to your authenticator.

XXXX-XXXX  XXXX-XXXX  XXXX-XXXX
XXXX-XXXX  XXXX-XXXX  XXXX-XXXX
XXXX-XXXX  XXXX-XXXX  XXXX-XXXX

[Copy codes] [Download PDF] [Print]

[I've saved my codes →]
```

### Login With 2FA

```
┌─────────────────────────────────┐
│ Enter 2FA code                  │
├─────────────────────────────────┤
│                                 │
│ Enter the 6-digit code from     │
│ your authenticator app          │
│                                 │
│ [______]  (auto-focus, auto-submit)│
│                                 │
│ Don't have your phone?          │
│ [Use backup code instead]       │
│                                 │
│ [Skip] (trust this device)      │
│                                 │
└─────────────────────────────────┘
```

**Auto-Submit**: Once 6 digits entered, immediately verify (don't wait for button click)

**Backup Code Entry**
```
[________________]

Format: XXXX-XXXX (accepts with or without dashes)
Auto-corrects spacing
One-time use (code invalidated after use)
```

**Trust This Device**
```
Checkbox: "Don't ask for 2FA on this device for 30 days"
Creates secure, HTTP-only cookie
Clear option in Settings to revoke all trusted devices
```

---

## 5. Onboarding Flow (Post-Signup)

### Step 1: Welcome

```
┌──────────────────────────────┐
│ Welcome to FlipTrybe! 🎉    │
├──────────────────────────────┤
│                              │
│ You're all set, [First Name]│
│                              │
│ Let's get you launched in    │
│ 3 minutes.                   │
│                              │
│ ✓ Create your first campaign │
│ ✓ Set up your wallet        │
│ ✓ Browse growth services    │
│                              │
│ [Get started →]              │
│ [Skip for now]               │
│                              │
└──────────────────────────────┘
```

### Step 2: Create First Campaign (Guided)

**Simplified wizard** (not the full 4-step):
```
Campaign Name: [Your First Campaign]

What's your goal?
○ Get more clicks to my site
○ Reach more people
○ Get conversions/sales
○ Grow engagement

Platform:
[TikTok] [Instagram] [YouTube]

Budget for today:
₦[5,000] (daily spend)

[Preview campaign] [Launch now]
```

### Step 3: Wallet Setup

```
Your wallet balance: ₦0

Add funds to launch campaigns

○ Bank transfer (1-2 hours)
  Fastest, no fees
  
○ Card payment (instant)
  Visa, Mastercard
  
[Add funds] or [Skip]
```

### Step 4: Graduation

```
✓ You're ready!

Your first campaign is pending review.
Review typically takes 30 minutes.

While you wait:
→ Browse growth services (SMM)
→ Read campaign best practices
→ Invite teammates

[Go to dashboard]
```

---

## Design Tokens for Auth Pages

### Colors
- **Primary**: #FF9500 (orange) — buttons, links, focus
- **Success**: #10B981 (green) — checkmarks, confirmation
- **Error**: #EF4444 (red) — validation, alerts
- **Warning**: #F59E0B (amber) — cautions
- **Background**: var(--surface-0) — light gray
- **Card**: var(--surface-2) — white

### Typography
- **Page Title**: 32px, bold (#0F172A)
- **Section Title**: 24px, semibold
- **Body**: 16px, regular
- **Label**: 14px, semibold
- **Helper**: 13px, regular, muted

### Spacing
- **Container**: max-width 1200px, padding 40px
- **Form**: max-width 400px
- **Gap**: 16px between fields, 24px between sections

---

## Security Best Practices

### Password Handling
```
✓ HTTPS only (never HTTP)
✓ Hash passwords with bcrypt (min 12 rounds)
✓ Never send password in email
✓ Enforce HTTPS on password reset links
✓ Reset links expire in 1 hour
✓ Don't reveal if email exists (prevent enumeration)
```

### Session Management
```
✓ HTTP-only, secure cookies
✓ Session timeout: 30 days idle (remember me)
✓ 12 hours active session, then re-login
✓ CSRF tokens on form submissions
✓ Rate limit login attempts (5 tries, 15 min lockout)
```

### 2FA Security
```
✓ TOTP codes: 30-second window, 6 digits
✓ Backup codes: one-time use only
✓ Regenerate new backup codes when used
✓ Store backup codes hashed
✓ Never email 2FA codes (SMS optional)
✓ Device trust: limit to 30 days
```

### Email Verification
```
✓ Token-based (not click-based)
✓ Token expires in 24 hours
✓ Resend limit: max 5 times per hour
✓ Use separate table for unverified emails
✓ Allow signup before verification (frictionless)
✓ Gate premium features until verified
```

---

## Accessibility (WCAG 2.1 AA)

### Keyboard Navigation
```
Tab order: Email → Password → [Remember me] → [Sign in]
Focus indicators: 2px orange outline
All buttons keyboard accessible (Enter to submit)
```

### Screen Readers
```
Form labels: <label for="email"> (associated)
Error messages: role="alert" aria-live="polite"
Buttons: aria-label="Sign in" for icon-only
Links: descriptive text ("Forgot password?" not "Click here")
```

### Color Contrast
```
Text on background: 4.5:1 (WCAG AA)
Error red (#EF4444) + white: 5.2:1 ✓
Success green (#10B981) + white: 6.4:1 ✓
```

### Motion & Animation
```
Fade-in: 300ms, ease-out
No auto-playing animations
Respects prefers-reduced-motion
```

---

## Mobile-Specific Design

### Viewport
```
Font size: 16px minimum (prevents auto-zoom on iOS)
Tap targets: 48px minimum
Spacing: 16px padding, 12px gaps
```

### Keyboard
```
Email: keyboard="email", autocapitalize="off"
Password: keyboard="none" (visual entry)
Phone: keyboard="tel", format hint "+234 ..."
```

### Two-Step
For complex flows on mobile:
```
Step 1 (left column): Email
Step 2 (right column): Verify
Swipe between steps (or tap chevrons)
Progress indicator at top
```

---

## Localization (Nigeria Focus)

### Currency & Format
```
Amounts: ₦5,000 (not ₦5000 or N5,000)
Phone: +234 format (WhatsApp friendly)
Date: DD/MM/YYYY (not MM/DD/YYYY)
Time: 24-hour (14:30 not 2:30 PM)
```

### Language
```
English (primary)
Yorùbá (future phase 2)
Igbo (future phase 2)
Hauša (future phase 2)
Avoid colonial/formal tone; use conversational Naija English
```

### Imagery
```
Avoid stock photos (cheap vibe)
Use real screenshots + user testimonials
Show Nigerian payment methods
Feature local businesses in copy
```

