# Account Settings & Profile Design Guide

## Overview
Comprehensive design specifications for user account settings, profile management, preferences, security, and workspace configuration.

---

## 1. Account Settings Hub

### Settings Navigation Structure

```
Account Settings

[Profile] [Security] [Notifications] [Billing] [Team] [Integrations] [API] [Preferences]

Primary sections (always visible):
├─ Profile (Personal info, avatar, preferences)
├─ Security (Password, 2FA, sessions, recovery codes)
├─ Notifications (Email preferences, alerts)
├─ Billing (Payment method, subscription, invoices)
├─ Team (Members, roles, invitations)
├─ Integrations (Connected apps, OAuth)
├─ API (Keys, webhooks, rate limits)
└─ Preferences (Theme, language, timezone)
```

---

## 2. Profile Settings

### Profile Overview

```
┌────────────────────────────────────────────────┐
│ [← Back] Account Settings                      │
├────────────────────────────────────────────────┤
│                                                │
│ [Profile] [Security] [Billing] [Team] [API]   │
│                                                │
│ ┌──────────────────────────────────────────┐  │
│ │ Your Profile                             │  │
│ ├──────────────────────────────────────────┤  │
│ │                                          │  │
│ │  [Avatar: 🟠]  [Upload New]             │  │
│ │                 [Remove]                │  │
│ │                                          │  │
│ │  Full Name                               │  │
│ │  [Chioma Adeyemi]                       │  │
│ │                                          │  │
│ │  Email Address                           │  │
│ │  [chioma@company.com]                   │  │
│ │  Status: Verified ✓ [Change Email]      │  │
│ │                                          │  │
│ │  Business Name                           │  │
│ │  [Chioma's Coffee Shop]                 │  │
│ │                                          │  │
│ │  Phone Number                            │  │
│ │  [+234 801 234 5678]                    │  │
│ │  Status: Verified ✓                      │  │
│ │                                          │  │
│ │  Country                                 │  │
│ │  [Nigeria 🇳🇬]                          │  │
│ │                                          │  │
│ │  Bio/About                               │  │
│ │  [Tell your story...] (optional)        │  │
│ │  [0/160 characters]                     │  │
│ │                                          │  │
│ │  [Save Changes]  [Cancel]                │  │
│ │                                          │  │
│ └──────────────────────────────────────────┘  │
│                                                │
│ Workspace Name                                 │
│ [Chioma's Ad Campaigns]                        │
│ [Edit Workspace Name]                          │
│                                                │
└────────────────────────────────────────────────┘
```

### Avatar Management

```
Upload Avatar (Step-by-step)

1. Select Image
   [Choose File] or drag & drop
   Recommended: 400x400px, PNG/JPG
   Max size: 5MB

2. Preview & Crop
   ┌─────────────────────────┐
   │  [Preview of image]     │
   │  [Drag to reposition]   │
   │  Scale: [─────●─────] │
   └─────────────────────────┘

3. Confirm
   [Cancel] [Upload]
   
Success: ✓ Avatar updated
```

### Profile Verification

```
Verification Status

Email: chioma@company.com
Status: ✓ Verified on March 15, 2026
Action: [Change Email] [Resend Verification]

Phone: +234 801 234 5678
Status: ⏳ Pending verification (expires in 24h)
Action: [Verify Now] [Change Phone]

Identity: ⏳ Not verified (optional for premium)
Info: Verify your identity to unlock advanced features
Action: [Verify Identity]
```

---

## 3. Security Settings

### Password & Authentication

```
┌────────────────────────────────────────────────┐
│ Security Settings                              │
├────────────────────────────────────────────────┤
│                                                │
│ Password & Login                               │
│ ┌────────────────────────────────────────────┐│
│ │ Current Password                           ││
│ │ Last changed: January 5, 2026              ││
│ │ [Change Password]                          ││
│ │                                            ││
│ │ Two-Factor Authentication (2FA)            ││
│ │ Status: ✓ Enabled                          ││
│ │ Method: Authenticator App (Google Auth)   ││
│ │ [Disable 2FA] [Change Method] [Setup SMS]  ││
│ │                                            ││
│ │ Backup Codes                               ││
│ │ Status: ✓ Generated (10/10 unused)         ││
│ │ Last Generated: March 15, 2026             ││
│ │ [Regenerate] [Download] [Print]           ││
│ └────────────────────────────────────────────┘│
│                                                │
│ Login & Sessions                               │
│ ┌────────────────────────────────────────────┐│
│ │ Active Sessions (5)                        ││
│ │                                            ││
│ │ ✓ Current Session                          ││
│ │  Chrome, Mac OS, Lagos, Nigeria            ││
│ │  Last active: just now                     ││
│ │  IP: 102.xxx.xxx.xxx                       ││
│ │                                            ││
│ │ Google Chrome, Windows, Abuja              ││
│ │ Last active: 3 hours ago                   ││
│ │ IP: 102.yyy.yyy.yyy                        ││
│ │ [Sign Out] [View Details]                 ││
│ │                                            ││
│ │ Mozilla Firefox, iPhone, Lagos             ││
│ │ Last active: Yesterday, 2:15 PM            ││
│ │ IP: 102.zzz.zzz.zzz                        ││
│ │ [Sign Out]                                 ││
│ │                                            ││
│ │ [Sign Out All Sessions] (except this one) ││
│ └────────────────────────────────────────────┘│
│                                                │
└────────────────────────────────────────────────┘
```

### Change Password Modal

```
┌────────────────────────────────────────┐
│ Change Password              [Close ✕] │
├────────────────────────────────────────┤
│                                        │
│ Current Password                       │
│ [••••••••] [Show]                     │
│ ⚠️  Wrong password (if incorrect)      │
│                                        │
│ New Password                           │
│ [••••••••] [Show]                     │
│ ✓ At least 12 characters             │
│ ✓ Mix of letters & numbers           │
│ ✓ Special character (!@#$...)        │
│                                        │
│ Confirm New Password                   │
│ [••••••••]                            │
│ ✓ Passwords match                     │
│                                        │
│ Password Strength: Strong (90%)        │
│ ████████░░                             │
│                                        │
│ [Cancel] [Update Password]             │
│                                        │
└────────────────────────────────────────┘
```

### Trusted Devices

```
Trusted Devices

Manage devices that skip 2FA verification for 30 days

┌──────────────────────────────────────┐
│ Device                 │ Last Active  │
├────────────────────────┼──────────────┤
│ 🖥️  Chrome, Mac OS     │ 30 min ago  │
│    (102.xxx.xxx.xxx)   │             │
│    Trust expires in 24 days           │
│    [Revoke Trust]                    │
├────────────────────────┼──────────────┤
│ 📱 Safari, iPhone       │ 4 days ago  │
│    (102.yyy.yyy.yyy)    │             │
│    [Revoke Trust]                    │
└──────────────────────────────────────┘

[Revoke All Trusted Devices]
```

### Security Checkup

```
Security Checkup

✓ Password: Strong (last changed Jan 5)
✓ 2FA: Enabled (Authenticator app)
✓ Backup codes: Generated & saved
⚠️  Recovery email: Not set (optional)
✓ Sessions: 5 active (all recognized)

Overall Security: Excellent ✓
[Improve]
```

---

## 4. Notification Preferences

### Email Notifications

```
┌────────────────────────────────────────────────┐
│ Notification Preferences                       │
├────────────────────────────────────────────────┤
│                                                │
│ [Email] [In-App] [SMS (coming soon)]          │
│                                                │
│ Email Notifications                            │
│                                                │
│ Campaign Updates                               │
│ ☑ Campaign created                            │
│ ☑ Campaign approved                           │
│ ☑ Campaign performance alerts                 │
│ ☑ Campaign paused (manual or auto)            │
│ ☑ Budget depleted warnings                    │
│                                                │
│ Growth Services Updates                        │
│ ☑ Order confirmed                             │
│ ☑ Order in progress                           │
│ ☑ Order completed                             │
│ ☑ Order issues or delays                      │
│ ☐ New services available                      │
│                                                │
│ Payment & Billing                              │
│ ☑ Payment successful                          │
│ ☑ Payment failed (retry notice)               │
│ ☑ Invoice generated                           │
│ ☑ Refund initiated                            │
│ ☑ Subscription renewal (7 days before)        │
│                                                │
│ Account & Security                             │
│ ☑ New login detected                          │
│ ☑ Password changed                            │
│ ☑ 2FA disabled                                │
│ ☑ Security alerts                             │
│ ☐ Weekly security report                      │
│                                                │
│ Communication                                  │
│ ☑ Weekly digest of activity                   │
│ ☐ Tips & best practices                       │
│ ☐ Feature announcements                       │
│ ☐ Product surveys                             │
│ ☐ Promotional emails                          │
│                                                │
│ [Save Preferences]                             │
│                                                │
└────────────────────────────────────────────────┘
```

### Notification Frequency

```
Frequency Settings

Campaign Performance Alerts
└─ Frequency: [Daily ▼]
   Options: Immediate | Daily Digest | Weekly | Off

Growth Services Updates
└─ Frequency: [Immediate ▼]
   Options: Immediate | Hourly | Daily | Off
   
Payment Alerts
└─ Frequency: [Immediate ▼]
   Options: Immediate | Daily | Off (critical) | Off

Marketing Emails
└─ Frequency: [Weekly ▼]
   Options: Weekly | Monthly | Quarterly | Off
```

---

## 5. Billing & Subscription

### Billing Overview

```
┌────────────────────────────────────────────────┐
│ Billing & Subscription                         │
├────────────────────────────────────────────────┤
│                                                │
│ Current Plan                                   │
│ ┌────────────────────────────────────────────┐│
│ │ Premium Monthly                            ││
│ │ ₦9,999 / month                             ││
│ │                                            ││
│ │ Benefits:                                  ││
│ │ ✓ Unlimited campaigns                      ││
│ │ ✓ Advanced analytics                       ││
│ │ ✓ 5 team members                           ││
│ │ ✓ Priority support                         ││
│ │ ✓ Custom integrations                      ││
│ │                                            ││
│ │ Renewal Date: August 15, 2026              ││
│ │ [Upgrade] [Change Plan] [Cancel Subscription]││
│ └────────────────────────────────────────────┘│
│                                                │
│ Payment Method                                 │
│ ┌────────────────────────────────────────────┐│
│ │ Visa ending in 4242                        ││
│ │ Exp: 12/28                                 ││
│ │ [Edit] [Remove]                            ││
│ │                                            ││
│ │ [+ Add Another Payment Method]              ││
│ └────────────────────────────────────────────┘│
│                                                │
│ Billing History (Last 6 Months)                │
│ ┌────────────────────────────────────────────┐│
│ │ Date       │ Description  │ Amount  │      ││
│ ├────────────┼──────────────┼─────────┼──────┤│
│ │ Jul 15     │ Premium      │ ₦9,999  │ Paid ││
│ │ Jun 15     │ Premium      │ ₦9,999  │ Paid ││
│ │ May 15     │ Pro→Premium  │ ₦-5,000 │ Paid ││
│ │ May 15     │ Pro Plan     │ ₦4,999  │ Paid ││
│ │ Apr 15     │ Pro Plan     │ ₦4,999  │ Paid ││
│ │ Mar 15     │ Pro Plan     │ ₦4,999  │ Paid ││
│ │ [Show More]                                ││
│ └────────────────────────────────────────────┘│
│                                                │
│ [Download Invoices] [Email Receipt]           │
│                                                │
└────────────────────────────────────────────────┘
```

### Upgrade / Plan Change

```
┌────────────────────────────────────────────────┐
│ Available Plans                                │
├────────────────────────────────────────────────┤
│                                                │
│ ┌─────────────┐  ┌──────────────┐  ┌────────┐│
│ │ Free        │  │ Pro          │  │Premium ││
│ │ ₦0/month    │  │ ₦4,999/month │  │₦9,999  ││
│ │             │  │              │  │/month  ││
│ │ ✓ 5 cam.   │  │ ✓ 50 cam.   │  │✓ ∞ cam││
│ │ ✓ Basic    │  │ ✓ Analytics  │  │✓ Adv.  ││
│ │ ✗ Team     │  │ ✓ 2 members  │  │✓ 5 mem││
│ │ ✗ Priority │  │ ✗ Priority   │  │✓ Prio  ││
│ │             │  │              │  │✓ API   ││
│ │ [Downgrade] │  │ [Current]    │  │[Upgrade]
│ │             │  │              │  │        ││
│ └─────────────┘  └──────────────┘  └────────┘│
│                                                │
│ Enterprise                                     │
│ [Contact Sales for custom pricing]            │
│                                                │
└────────────────────────────────────────────────┘
```

### Invoice

```
┌────────────────────────────────────────────────┐
│ Invoice #INV-2026-07-001                       │
│                                                │
│ Date: July 15, 2026                            │
│ Due: Paid (July 15, 2026)                      │
│                                                │
│ Bill To:                                       │
│ Chioma Adeyemi                                 │
│ chioma@company.com                             │
│ +234 801 234 5678                             │
│                                                │
│ Description          │ Qty │ Rate    │ Amount  │
│ ─────────────────────┼─────┼─────────┼─────────│
│ Premium Plan         │ 1   │ ₦9,999  │ ₦9,999  │
│ Pro Plan Credit      │ 1   │ -₦4,999 │ -₦4,999 │
│                      │     │         │         │
│ Subtotal             │     │         │ ₦5,000  │
│ VAT (7.5%)           │     │         │ ₦375    │
│ Total                │     │         │ ₦5,375  │
│                      │     │         │         │
│ Payment Method: Visa ••••4242                  │
│ Transaction ID: txn_1234567890                 │
│                                                │
│ [Download PDF] [Email]                        │
│                                                │
└────────────────────────────────────────────────┘
```

---

## 6. Team Management

### Team Members

```
┌────────────────────────────────────────────────┐
│ Team Members (3/5)                             │
├────────────────────────────────────────────────┤
│                                                │
│ [+ Invite Member]  [Manage Roles]             │
│                                                │
│ ┌────────────────────────────────────────────┐│
│ │ Member          │ Email            │ Role  ││
│ ├─────────────────┼──────────────────┼───────┤│
│ │ 👤 Chioma       │ chioma@co.com    │ Owner ││
│ │ (You)           │ Status: Active   │       ││
│ │                 │ Joined: Mar 2026 │       ││
│ │                 │ [Edit] [Remove]  │       ││
│ ├─────────────────┼──────────────────┼───────┤│
│ │ 👤 Bola         │ bola@co.com      │ Admin ││
│ │                 │ Status: Active   │       ││
│ │                 │ Joined: May 2026 │       ││
│ │                 │ [Edit] [Remove]  │       ││
│ ├─────────────────┼──────────────────┼───────┤│
│ │ 👤 Zainab       │ z.hassan@co.com  │ Member││
│ │                 │ Status: Invited  │       ││
│ │                 │ Invitation sent: 2d ago  ││
│ │                 │ [Resend] [Remove]│       ││
│ └────────────────────────────────────────────┘│
│                                                │
└────────────────────────────────────────────────┘
```

### Invite Member Modal

```
┌────────────────────────────────────────────────┐
│ Invite Team Member                   [Close ✕] │
├────────────────────────────────────────────────┤
│                                                │
│ Email Address(es)                              │
│ [Enter email or paste multiple...]             │
│ Example: name@company.com                      │
│                                                │
│ Role                                           │
│ [Admin ▼]                                      │
│ Options:                                       │
│   Admin: Full access (edit, manage, delete)    │
│   Member: Limited access (create, view only)   │
│   Viewer: Read-only access                     │
│                                                │
│ Custom Permissions (Advanced)                  │
│ ☑ Create campaigns                            │
│ ☑ Edit campaigns                              │
│ ☑ View analytics                              │
│ ☑ Manage team                                 │
│ ☑ View billing                                │
│                                                │
│ Message (Optional)                             │
│ [Type a personal message...]                  │
│                                                │
│ [Cancel] [Send Invitation]                     │
│                                                │
└────────────────────────────────────────────────┘
```

### Role Permissions Matrix

```
Permission Matrix

                    │ Owner │ Admin │ Member │ Viewer
────────────────────┼───────┼───────┼────────┼───────
Campaigns           │       │       │        │
  Create            │  ✓    │  ✓    │   ✓    │  ✗
  Edit              │  ✓    │  ✓    │   ✓    │  ✗
  Delete            │  ✓    │  ✓    │   ✗    │  ✗
  View Analytics    │  ✓    │  ✓    │   ✓    │  ✓
────────────────────┼───────┼───────┼────────┼───────
Growth Services     │       │       │        │
  Create Orders     │  ✓    │  ✓    │   ✓    │  ✗
  View Orders       │  ✓    │  ✓    │   ✓    │  ✓
  Manage Orders     │  ✓    │  ✓    │   ✗    │  ✗
────────────────────┼───────┼───────┼────────┼───────
Wallet & Billing    │       │       │        │
  View Balance      │  ✓    │  ✓    │   ✓    │  ✗
  Add Funds         │  ✓    │  ✓    │   ✗    │  ✗
  View Invoices     │  ✓    │  ✓    │   ✗    │  ✗
  Manage Billing    │  ✓    │  ✗    │   ✗    │  ✗
────────────────────┼───────┼───────┼────────┼───────
Team Management     │       │       │        │
  Invite Members    │  ✓    │  ✓    │   ✗    │  ✗
  Edit Roles        │  ✓    │  ✗    │   ✗    │  ✗
  Remove Members    │  ✓    │  ✓    │   ✗    │  ✗
────────────────────┼───────┼───────┼────────┼───────
Settings            │       │       │        │
  Edit Account      │  ✓    │  ✓    │   ✗    │  ✗
  API Keys          │  ✓    │  ✓    │   ✗    │  ✗
```

---

## 7. Integrations

### Connected Apps

```
┌────────────────────────────────────────────────┐
│ Integrations & Connected Apps                  │
├────────────────────────────────────────────────┤
│                                                │
│ Ad Platforms (Connected: 2/4)                  │
│ ┌────────────────────────────────────────────┐│
│ │ Meta Business                              ││
│ │ ✓ Connected on July 15, 2026               ││
│ │ Account: "Coffee Shop Marketing"           ││
│ │ Status: Healthy (last sync: 5 min ago)     ││
│ │ Permissions: Campaigns, Insights, Billing  ││
│ │ [Reconnect] [Disconnect] [Manage]          ││
│ ├────────────────────────────────────────────┤│
│ │ TikTok Ads                                 ││
│ │ ✓ Connected on June 1, 2026                ││
│ │ Account: "chioma_ads"                      ││
│ │ Status: Healthy (last sync: 8 min ago)     ││
│ │ [Reconnect] [Disconnect] [Manage]          ││
│ ├────────────────────────────────────────────┤│
│ │ Google Ads                                 ││
│ │ ✗ Not connected                            ││
│ │ [Connect Google Ads]                       ││
│ ├────────────────────────────────────────────┤│
│ │ LinkedIn Ads                               ││
│ │ ✗ Not connected                            ││
│ │ [Connect LinkedIn]                         ││
│ └────────────────────────────────────────────┘│
│                                                │
│ Analytics & CRM                                │
│ ┌────────────────────────────────────────────┐│
│ │ Google Analytics 4                         ││
│ │ ✓ Connected                                ││
│ │ Property ID: G-XXXXXXXXXX                  ││
│ │ [Disconnect] [Manage]                      ││
│ └────────────────────────────────────────────┘│
│                                                │
│ [+ Add More Integrations]                      │
│                                                │
└────────────────────────────────────────────────┘
```

### OAuth Connection Flow

```
1. Click [Connect Meta Business]
   ↓
2. Redirect to Meta Login
   "FlipTrybe wants to access your Meta Business"
   [Cancel] [Allow]
   ↓
3. Select Business Account
   [Coffee Shop Marketing]
   ↓
4. Grant Permissions
   ☑ Access campaigns
   ☑ Access insights
   ☑ Access billing
   [Cancel] [Allow]
   ↓
5. Success Screen
   ✓ Meta Business connected
   Account: "Coffee Shop Marketing"
   [Go to Settings]
```

---

## 8. API & Webhooks

### API Keys

```
┌────────────────────────────────────────────────┐
│ API Keys & Webhooks                            │
├────────────────────────────────────────────────┤
│                                                │
│ API Keys                                       │
│ [+ Create New API Key]                         │
│                                                │
│ ┌────────────────────────────────────────────┐│
│ │ Production Key #1                          ││
│ │ Key: pk_live_abc123def456...               ││
│ │ [Copy] [Show Full Key]                     ││
│ │ Status: Active                             ││
│ │ Created: July 1, 2026                      ││
│ │ Last used: 2 hours ago                     ││
│ │ Requests (30d): 47,382                     ││
│ │ [Regenerate] [Disable] [Delete]            ││
│ ├────────────────────────────────────────────┤│
│ │ Development Key #1                         ││
│ │ Key: pk_test_xyz789uvw012...               ││
│ │ [Copy]                                     ││
│ │ Status: Inactive (not used in 30d)        ││
│ │ [Enable] [Delete]                          ││
│ └────────────────────────────────────────────┘│
│                                                │
│ Rate Limits                                    │
│ Standard tier:                                 │
│   • 100 requests / 60 seconds                 │
│   • 1,000 requests / 15 minutes               │
│ Current usage: 47,382 / 1,000,000 (monthly)   │
│ [Upgrade to higher tier]                      │
│                                                │
└────────────────────────────────────────────────┘
```

### Webhooks

```
┌────────────────────────────────────────────────┐
│ Webhooks                                       │
│ [+ Create New Webhook]                         │
├────────────────────────────────────────────────┤
│                                                │
│ ┌────────────────────────────────────────────┐│
│ │ Campaign Events                            ││
│ │ Endpoint: https://yoursite.com/webhooks   ││
│ │ Status: ✓ Active (last delivered: 5 min)  ││
│ │ Subscribed Events:                         ││
│ │   • campaign.created                       ││
│ │   • campaign.updated                       ││
│ │   • campaign.paused                        ││
│ │ [Edit] [Test] [Disable] [Delete]           ││
│ ├────────────────────────────────────────────┤│
│ │ Order Events                               ││
│ │ Endpoint: https://api.yoursite.com/orders ││
│ │ Status: ⚠️  Inactive (last error: 30 min) ││
│ │ Subscribed Events:                         ││
│ │   • order.created                          ││
│ │   • order.updated                          ││
│ │ Retries: 3/5 (last retry: 15 min ago)     ││
│ │ [View Logs] [Retry] [Delete]              ││
│ └────────────────────────────────────────────┘│
│                                                │
│ Recent Deliveries                              │
│ ┌────────────────────────────────────────────┐│
│ │ Time      │ Event         │ Status        ││
│ ├───────────┼───────────────┼───────────────┤│
│ │ 2:15 PM   │ order.updated │ ✓ Success     ││
│ │ 2:10 PM   │ order.created │ ✓ Success     ││
│ │ 1:55 PM   │ order.updated │ ✗ Failed      ││
│ │ 1:50 PM   │ campaign.crea │ ✓ Success     ││
│ │ [Show More]                                ││
│ └────────────────────────────────────────────┘│
│                                                │
└────────────────────────────────────────────────┘
```

---

## 9. Preferences & General Settings

### Display & Behavior

```
┌────────────────────────────────────────────────┐
│ Preferences                                    │
├────────────────────────────────────────────────┤
│                                                │
│ Theme & Display                                │
│ ○ Light Mode                                  │
│ ● Dark Mode                                   │
│ ○ System Preference (auto-switch)             │
│                                                │
│ Language                                       │
│ [English ▼]                                   │
│ Available: English, Yorùbá (beta), Igbo (beta)│
│                                                │
│ Timezone                                       │
│ [Africa/Lagos ▼]                              │
│ Auto-detect: Enabled ✓                        │
│ Current time: 14:23:15 WAT                    │
│                                                │
│ Date Format                                    │
│ [DD/MM/YYYY ▼]                                │
│ Preview: 15 Jul 2026                          │
│                                                │
│ Currency                                       │
│ [NGN (₦) ▼]                                   │
│                                                │
│ Density                                        │
│ ○ Compact (tighter spacing)                   │
│ ● Comfortable (default)                       │
│ ○ Spacious (more padding)                     │
│                                                │
│ [Save Preferences]                             │
│                                                │
└────────────────────────────────────────────────┘
```

---

## 10. Desktop & Mobile Settings Navigation

### Desktop Layout

```
┌────────────────────────────────────────────────┐
│ Settings                                       │
├─────────────────┬───────────────────────────────┤
│                 │                               │
│ Sidebar Tabs:   │ Main Content Area            │
│ • Profile       │ (shows selected section)     │
│ • Security      │                               │
│ • Notifications │                               │
│ • Billing       │                               │
│ • Team          │                               │
│ • Integrations  │                               │
│ • API           │                               │
│ • Preferences   │                               │
│                 │                               │
│ [Help & FAQ]    │                               │
│ [Contact Support]                              │
│                 │                               │
└─────────────────┴───────────────────────────────┘
```

### Mobile Layout

```
Settings

[← Back]

Navigation (Accordion or Tabs):
┌─────────────────────────────────┐
│ ▼ Profile                       │
│   • Edit Profile                │
│   • Avatar                       │
│   • Verification Status         │
├─────────────────────────────────┤
│ ▼ Security                      │
│   • Password                     │
│   • 2FA                          │
│   • Sessions                     │
│   • Backup Codes                │
├─────────────────────────────────┤
│ ▼ Notifications                 │
│   • Email                        │
│   • In-App                       │
│   • Frequency                    │
├─────────────────────────────────┤
│ ▼ Billing                       │
│   • Plan & Subscription          │
│   • Payment Method               │
│   • Invoices                     │
├─────────────────────────────────┤
│ [Help] [Support] [Sign Out]     │
└─────────────────────────────────┘
```

---

## 11. Sign Out & Account Deletion

### Sign Out

```
┌────────────────────────────────────┐
│ Sign Out                [Confirm ✓] │
├────────────────────────────────────┤
│                                    │
│ You will be signed out on:         │
│ This browser and device only       │
│                                    │
│ To sign out all sessions:          │
│ Go to Settings → Security →        │
│ Active Sessions → Sign Out All     │
│                                    │
│ [Cancel] [Sign Out]                │
│                                    │
└────────────────────────────────────┘

After signing out:
→ Redirected to login page
→ Session token invalidated
→ Other sessions remain active
```

### Delete Account

```
┌────────────────────────────────────────────────┐
│ Delete Account                     [Close ✕]   │
├────────────────────────────────────────────────┤
│                                                │
│ ⚠️  Warning: This action is permanent         │
│                                                │
│ Deleting your account will:                   │
│ ✗ Remove all campaigns (archived)             │
│ ✗ Remove all growth service orders            │
│ ✗ Delete your wallet & transaction history   │
│ ✗ Disable your API keys                       │
│ ✗ Remove team members (keep their workspaces)│
│                                                │
│ We will retain:                               │
│ ✓ Payment/billing records (7 years, legally)  │
│ ✓ Fraud/compliance audit logs (7 years)       │
│                                                │
│ Confirm Deletion                              │
│ ☐ I understand this is permanent              │
│ ☐ I have backed up important data             │
│ ☐ Delete my account                           │
│                                                │
│ [All 3 checked] → [Delete Account] enabled    │
│                                                │
│ Password Confirmation                         │
│ [••••••••]                                     │
│                                                │
│ [Cancel] [Delete My Account]                  │
│                                                │
└────────────────────────────────────────────────┘

After deletion:
Email sent: "Account deleted on [date]"
Redirect to homepage after 3 seconds
```

---

## 12. Design System for Settings

### Colors
```
Primary action: #FF9500 (orange)
Danger: #EF4444 (red) for deletion, suspension
Success: #10B981 (green) for verification
Warning: #F59E0B (amber) for alerts
```

### Typography
```
Section title: 24px semibold
Label: 14px semibold
Body: 14px regular
Helper text: 13px regular muted
```

### Spacing
```
Section gap: 24px
Field gap: 16px
Group padding: 20px
Container max-width: 800px
```

---

## 13. Accessibility

### Screen Reader Support
```
✓ Form labels associated with inputs
✓ Error messages linked via aria-describedby
✓ Status updates announced via aria-live
✓ Confirmation dialogs with role="alertdialog"
✓ Toggle switches with aria-checked
```

### Keyboard Navigation
```
✓ Tab through all form fields
✓ Enter/Space to toggle checkboxes
✓ Enter to submit forms
✓ Escape to close modals
✓ Focus indicators: 2px orange outline
```

---

## 14. Performance Targets

```
Settings page load: < 1.5s
Form submission: < 1s
API response: < 200ms
```

---

## 15. Implementation Priority

### Phase 1 (Week 1)
- [ ] Profile settings
- [ ] Password change
- [ ] Email notifications
- [ ] Basic sidebar nav

### Phase 2 (Week 2)
- [ ] 2FA setup & management
- [ ] Billing & subscription
- [ ] Team management
- [ ] Security sessions

### Phase 3 (Week 3)
- [ ] API keys & webhooks
- [ ] Integrations management
- [ ] Account deletion flow
- [ ] Mobile responsiveness

### Phase 4 (Week 4+)
- [ ] Dark mode
- [ ] Advanced preferences
- [ ] Audit logs
- [ ] Backup & export data

