# FlipTrybe UI Implementation Guide

## Quick Reference: Component Code Examples

### 1. Dashboard Hero Section

```tsx
// apps/web/app/components/DashboardHero.tsx
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'

export function DashboardHero({ stats, campaigns }) {
  return (
    <div className="space-y-6">
      {/* Performance Summary */}
      <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
        <CardHeader>
          <h2 className="text-2xl font-bold text-slate-900">
            📊 Campaign Performance (Last 7 Days)
          </h2>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-6">
          {/* Spend */}
          <div>
            <p className="text-sm font-medium text-slate-600">Total Spend</p>
            <p className="text-3xl font-bold text-orange-600">₦{stats.spend.toLocaleString()}</p>
            <div className="mt-2 bg-slate-200 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-orange-500 h-full"
                style={{ width: `${(stats.spend / stats.budget) * 100}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {Math.round((stats.spend / stats.budget) * 100)}% of budget used
            </p>
          </div>

          {/* ROI */}
          <div>
            <p className="text-sm font-medium text-slate-600">ROI</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-green-600">{stats.roi.toFixed(1)}x</p>
              <Badge variant="outline" className="bg-green-50 text-green-700">
                <TrendingUp className="w-3 h-3 mr-1" />
                +18% vs last week
              </Badge>
            </div>
          </div>

          {/* Reach */}
          <div>
            <p className="text-sm font-medium text-slate-600">Reach</p>
            <p className="text-3xl font-bold text-blue-600">
              {(stats.reach / 1000000).toFixed(1)}M
            </p>
            <p className="text-xs text-slate-500 mt-1">people reached</p>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Status Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-8">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium">{campaigns.active} Active</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              <span className="text-sm font-medium">{campaigns.paused} Paused</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-sm font-medium">{campaigns.failed} Failed</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

### 2. Smart Filter Bar

```tsx
// apps/web/app/components/CampaignFilterBar.tsx
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Dropdown } from '@/components/ui/dropdown'

export function CampaignFilterBar({ filters, onFilterChange }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
      {/* Status Filter */}
      <div>
        <label className="text-sm font-medium text-slate-700">Status</label>
        <div className="flex gap-2 mt-2">
          {['Active', 'Scheduled', 'Paused', 'Failed'].map((status) => (
            <Button
              key={status}
              variant={filters.status === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => onFilterChange('status', status)}
              className={filters.status === status ? 'bg-orange-500 hover:bg-orange-600' : ''}
            >
              {status}
              <span className="ml-2 text-xs font-semibold bg-white/20 px-2 py-0.5 rounded">
                {/* Count badges would go here */}
              </span>
            </Button>
          ))}
        </div>
      </div>

      {/* Platform Filter */}
      <div>
        <label className="text-sm font-medium text-slate-700">Platform</label>
        <Dropdown
          options={['All', 'TikTok', 'Instagram', 'YouTube', 'Facebook']}
          value={filters.platform}
          onChange={(value) => onFilterChange('platform', value)}
          className="mt-2"
        />
      </div>

      {/* Performance Filter */}
      <div>
        <label className="text-sm font-medium text-slate-700">Performance</label>
        <SegmentedControl
          options={['Top Performers', 'At Risk', 'New', 'All']}
          value={filters.performance}
          onChange={(value) => onFilterChange('performance', value)}
          className="mt-2"
        />
      </div>
    </div>
  )
}
```

### 3. Campaign Card (New Design)

```tsx
// apps/web/app/components/CampaignCard.tsx
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MoreVertical, TrendingUp, Target } from 'lucide-react'

export function CampaignCard({ campaign, onAction }) {
  const getStatusColor = (status) => {
    const colors = {
      ACTIVE: 'bg-green-100 text-green-800',
      PAUSED: 'bg-yellow-100 text-yellow-800',
      FAILED: 'bg-red-100 text-red-800',
      SCHEDULED: 'bg-blue-100 text-blue-800',
    }
    return colors[status] || 'bg-slate-100 text-slate-800'
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-orange-500" />
              <h3 className="text-lg font-semibold text-slate-900">{campaign.name}</h3>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className={getStatusColor(campaign.status)}>
                {campaign.status === 'ACTIVE' ? '▶️' : '⏸'} {campaign.status}
              </Badge>
              <span className="text-xs text-slate-500">
                {campaign.daysRemaining} days left
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200">
          {/* Budget */}
          <div>
            <p className="text-xs font-medium text-slate-600 uppercase">Budget</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1">
                <div className="bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-orange-500 h-full"
                    style={{ width: `${(campaign.spent / campaign.budget) * 100}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-semibold text-slate-900">
                {Math.round((campaign.spent / campaign.budget) * 100)}%
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              ₦{campaign.spent.toLocaleString()} / ₦{campaign.budget.toLocaleString()}
            </p>
          </div>

          {/* ROI */}
          <div>
            <p className="text-xs font-medium text-slate-600 uppercase">ROI</p>
            <p className="text-xl font-bold text-green-600 mt-1">{campaign.roi.toFixed(1)}x</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-green-600" />
              <span className="text-xs text-green-600 font-medium">
                +{campaign.roiTrend}% vs last week
              </span>
            </div>
          </div>

          {/* Reach */}
          <div>
            <p className="text-xs font-medium text-slate-600 uppercase">Reach</p>
            <p className="text-xl font-bold text-blue-600 mt-1">
              {(campaign.reach / 1000).toFixed(0)}K
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {campaign.reasStatus === 'trending' ? '📈 Trending up' : '📉 Leveling off'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t border-slate-200">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onAction('view', campaign.id)}
          >
            View Details
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onAction('edit', campaign.id)}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-yellow-600 hover:bg-yellow-50"
            onClick={() => onAction('pause', campaign.id)}
          >
            {campaign.status === 'ACTIVE' ? 'Pause' : 'Resume'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

### 4. Campaign Creation Wizard

```tsx
// apps/web/app/components/CampaignWizard.tsx
import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { HelpCircle } from 'lucide-react'

const STEPS = [
  { id: 1, name: 'Basics', progress: 25 },
  { id: 2, name: 'Audience', progress: 50 },
  { id: 3, name: 'Creative', progress: 75 },
  { id: 4, name: 'Budget', progress: 100 },
]

export function CampaignWizard({ onComplete }) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState({})

  const currentStep = STEPS.find(s => s.id === step)

  return (
    <div className="space-y-6">
      {/* Progress Indicators */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-900">Create Campaign</h1>
          <span className="text-sm font-medium text-slate-600">Step {step} of 4</span>
        </div>
        <Progress value={currentStep.progress} className="h-2" />
        <div className="flex gap-4">
          {STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => s.id < step && setStep(s.id)}
              className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-colors ${
                s.id === step
                  ? 'bg-orange-500 text-white'
                  : s.id < step
                  ? 'bg-green-100 text-green-800 cursor-pointer'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {s.id < step ? '✓' : s.id} {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <div className="p-8">
          {step === 1 && <StepBasics data={data} setData={setData} />}
          {step === 2 && <StepAudience data={data} setData={setData} />}
          {step === 3 && <StepCreative data={data} setData={setData} />}
          {step === 4 && <StepBudget data={data} setData={setData} />}
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
        >
          Back
        </Button>
        <div className="flex gap-2">
          {step < 4 ? (
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => setStep(step + 1)}
            >
              Next
            </Button>
          ) : (
            <Button
              className="bg-green-500 hover:bg-green-600"
              onClick={() => onComplete(data)}
            >
              Create Campaign
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// Step components
function StepBasics({ data, setData }) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Campaign Name
        </label>
        <input
          type="text"
          value={data.name || ''}
          onChange={(e) => setData({ ...data, name: e.target.value })}
          placeholder="e.g., Coffee Shop Launch"
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
        />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="block text-sm font-medium text-slate-700">
            Objective
          </label>
          <HelpCircle className="w-4 h-4 text-slate-400 cursor-help" 
            title="Objectives determine how your ad is delivered and optimized"
          />
        </div>
        <select
          value={data.objective || ''}
          onChange={(e) => setData({ ...data, objective: e.target.value })}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
        >
          <option>Awareness</option>
          <option>Traffic</option>
          <option>Conversions</option>
          <option>Engagement</option>
        </select>
        <p className="text-xs text-slate-500 mt-2">
          {data.objective === 'Traffic' && 'Optimize for clicks to your website'}
          {data.objective === 'Conversions' && 'Optimize for sales or sign-ups'}
          {data.objective === 'Awareness' && 'Maximize reach and impressions'}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Platform
        </label>
        <div className="grid grid-cols-2 gap-3">
          {['TikTok', 'Instagram', 'YouTube', 'Facebook'].map((platform) => (
            <button
              key={platform}
              onClick={() => setData({ ...data, platform })}
              className={`py-3 px-4 border-2 rounded-lg font-medium transition-colors ${
                data.platform === platform
                  ? 'border-orange-500 bg-orange-50 text-orange-900'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              {platform}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Additional step components follow similar pattern...
function StepAudience({ data, setData }) {
  return <div className="text-center py-12 text-slate-500">Audience configuration</div>
}

function StepCreative({ data, setData }) {
  return <div className="text-center py-12 text-slate-500">Creative upload & preview</div>
}

function StepBudget({ data, setData }) {
  return <div className="text-center py-12 text-slate-500">Budget & schedule</div>
}
```

### 5. Wallet Balance Card

```tsx
// apps/web/app/components/WalletCard.tsx
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Wallet, Lock, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

export function WalletCard({ wallet }) {
  const [showBalance, setShowBalance] = useState(true)

  const maskBalance = (amount) => '₦' + '•'.repeat(6)

  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <CardContent className="p-6 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <Wallet className="w-6 h-6" />
            <h3 className="text-lg font-semibold">Wallet Balance</h3>
          </div>
          <button onClick={() => setShowBalance(!showBalance)} className="p-1">
            {showBalance ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </button>
        </div>

        {/* Balances */}
        <div className="space-y-3 pt-4 border-t border-slate-700">
          <div>
            <p className="text-sm font-medium text-slate-300">Available</p>
            <p className="text-3xl font-bold mt-1">
              {showBalance ? `₦${wallet.available.toLocaleString()}` : maskBalance()}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <Lock className="w-4 h-4 text-yellow-400" />
              <p className="text-sm font-medium text-slate-300">On Hold</p>
              <Badge variant="secondary" className="ml-auto">
                {wallet.onHoldOrders} orders
              </Badge>
            </div>
            <p className="text-lg font-semibold text-yellow-400">
              {showBalance ? `₦${wallet.onHold.toLocaleString()}` : maskBalance()}
            </p>
          </div>

          <div className="pt-3 border-t border-slate-700">
            <p className="text-sm font-medium text-slate-400">Total</p>
            <p className="text-2xl font-bold mt-1">
              {showBalance ? `₦${wallet.total.toLocaleString()}` : maskBalance()}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-slate-700">
          <Button
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => {/* Open add funds modal */}}
          >
            Add Funds
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-slate-600 text-white hover:bg-slate-700"
            onClick={() => {/* Open transactions */}}
          >
            Transactions
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

### 6. Navigation Sidebar

```tsx
// apps/web/app/components/Sidebar.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  BarChart3,
  Target,
  Zap,
  CreditCard,
  Settings,
  HelpCircle,
  Menu,
  X,
} from 'lucide-react'

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, path: '/' },
  {
    id: 'campaigns',
    label: 'Campaigns',
    icon: Target,
    path: '/campaigns',
    submenu: [
      { label: 'Create New', path: '/campaigns/new' },
      { label: 'My Campaigns', path: '/campaigns', badge: '45' },
      { label: 'Templates', path: '/campaigns/templates', badge: '12' },
      { label: 'Archive', path: '/campaigns/archive', badge: '3' },
    ],
  },
  {
    id: 'growth',
    label: 'Growth Services',
    icon: Zap,
    path: '/growth',
    submenu: [
      { label: 'Browse Services', path: '/growth/services' },
      { label: 'My Orders', path: '/growth/orders', badge: '8' },
      { label: 'Analytics', path: '/growth/analytics' },
    ],
  },
  {
    id: 'billing',
    label: 'Wallet & Billing',
    icon: CreditCard,
    path: '/wallet',
    submenu: [
      { label: 'Balance', path: '/wallet' },
      { label: 'Add Funds', path: '/wallet/add' },
      { label: 'Transactions', path: '/wallet/transactions' },
      { label: 'Invoices', path: '/wallet/invoices' },
    ],
  },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  { id: 'help', label: 'Help & Resources', icon: HelpCircle, path: '/help' },
]

export function Sidebar({ open, onClose }) {
  const [expanded, setExpanded] = useState({})

  const toggleSubmenu = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen bg-slate-50 border-r border-slate-200 w-64 transform transition-transform duration-300 z-50 md:relative md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-orange-600">FlipTrybe</h1>
            <p className="text-xs text-slate-500 mt-1">📊 Ad Campaigner</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {MENU_ITEMS.map((item) => (
            <div key={item.id}>
              <button
                onClick={() => item.submenu && toggleSubmenu(item.id)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-slate-700 hover:bg-slate-100 font-medium text-sm transition-colors"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5 text-slate-600" />
                  {item.label}
                </div>
                {item.submenu && (
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      expanded[item.id] ? 'rotate-180' : ''
                    }`}
                  />
                )}
              </button>

              {/* Submenu */}
              {item.submenu && expanded[item.id] && (
                <div className="ml-4 space-y-1 mt-2 border-l-2 border-orange-200 pl-3">
                  {item.submenu.map((subitem) => (
                    <a
                      key={subitem.path}
                      href={subitem.path}
                      className="flex items-center justify-between px-3 py-2 rounded text-slate-600 hover:bg-slate-100 text-sm transition-colors"
                    >
                      <span>{subitem.label}</span>
                      {subitem.badge && (
                        <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded">
                          {subitem.badge}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 space-y-3">
          <Button variant="outline" className="w-full text-sm">
            📚 Documentation
          </Button>
          <Button variant="ghost" className="w-full justify-start text-sm text-slate-600">
            💬 Contact Support
          </Button>
        </div>
      </aside>
    </>
  )
}
```

---

## CSS Variables for Theming

```css
/* globals.css */
@layer root {
  :root {
    --color-primary: #FF9500;      /* Orange - action/CTA */
    --color-success: #10B981;      /* Green - positive/active */
    --color-warning: #F59E0B;      /* Amber - at-risk */
    --color-error: #EF4444;        /* Red - failed/error */
    --color-info: #3B82F6;         /* Blue - informational */
    
    --color-slate-50: #F8FAFC;
    --color-slate-100: #F1F5F9;
    --color-slate-200: #E2E8F0;
    --color-slate-300: #CBD5E1;
    --color-slate-400: #94A3B8;
    --color-slate-500: #64748B;
    --color-slate-600: #475569;
    --color-slate-700: #334155;
    --color-slate-800: #1E293B;
    --color-slate-900: #0F172A;

    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
    --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --color-slate-50: #020617;
      --color-slate-100: #0F172A;
      --color-slate-200: #1E293B;
      --color-slate-300: #334155;
      --color-slate-400: #475569;
      --color-slate-500: #64748B;
      --color-slate-600: #94A3B8;
      --color-slate-700: #CBD5E1;
      --color-slate-800: #E2E8F0;
      --color-slate-900: #F8FAFC;
    }
  }
}
```

---

## Tailwind Config Extension

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        orange: {
          50: '#FFF7ED',
          500: '#FF9500',
          600: '#EA8C00',
        },
      },
      boxShadow: {
        'sm-orange': '0 1px 3px 0 rgba(255, 149, 0, 0.1)',
        'md-orange': '0 4px 6px -1px rgba(255, 149, 0, 0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
```

---

## File Structure for Implementation

```
apps/web/
├── app/
│   ├── components/
│   │   ├── ui/                    # Shadcn/UI components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── ...
│   │   ├── Sidebar.tsx            # Main navigation
│   │   ├── DashboardHero.tsx      # Dashboard summary
│   │   ├── CampaignCard.tsx       # Campaign card
│   │   ├── CampaignFilterBar.tsx  # Smart filters
│   │   ├── CampaignWizard.tsx     # Multi-step form
│   │   ├── WalletCard.tsx         # Wallet display
│   │   ├── PerformanceChart.tsx   # Analytics charts
│   │   ├── Toast.tsx              # Toast notifications
│   │   ├── Modal.tsx              # Modals
│   │   └── ...
│   ├── (dashboard)/               # Dashboard layout
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── ...
│   ├── (campaigns)/               # Campaign flows
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   └── [id]/page.tsx
│   ├── (growth)/                  # Growth services
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   └── globals.css
├── .storybook/                    # Storybook docs
│   ├── main.js
│   └── preview.js
├── tailwind.config.js
└── tsconfig.json
```

---

## Testing Component Examples

```tsx
// apps/web/app/components/__tests__/DashboardHero.test.tsx
import { render, screen } from '@testing-library/react'
import { DashboardHero } from '../DashboardHero'

describe('DashboardHero', () => {
  it('displays spend as percentage of budget', () => {
    const stats = {
      spend: 75000,
      budget: 100000,
      roi: 3.2,
      reach: 1200000,
    }
    const campaigns = { active: 3, paused: 2, failed: 1 }

    render(<DashboardHero stats={stats} campaigns={campaigns} />)

    expect(screen.getByText(/75% of budget used/)).toBeInTheDocument()
    expect(screen.getByText('3 Active')).toBeInTheDocument()
  })

  it('highlights ROI trend', () => {
    const stats = {
      spend: 50000,
      budget: 100000,
      roi: 2.5,
      reach: 800000,
    }

    render(<DashboardHero stats={stats} campaigns={{ active: 1, paused: 0, failed: 0 }} />)

    expect(screen.getByText(/\+18% vs last week/)).toBeInTheDocument()
  })
})
```

---

## Migration Checklist

- [ ] Install Shadcn/UI components
- [ ] Update Tailwind config with design tokens
- [ ] Create design system documentation (Storybook)
- [ ] Implement dashboard redesign
- [ ] Build campaign wizard flow
- [ ] Redesign campaign card component
- [ ] Add wallet balance visualization
- [ ] Implement smart filter bar
- [ ] Add micro-interactions (toasts, modals)
- [ ] Mobile responsiveness testing
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Dark mode support
- [ ] User testing & iteration

