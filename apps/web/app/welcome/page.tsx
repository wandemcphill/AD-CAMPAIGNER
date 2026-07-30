"use client";

import { useState } from "react";
import { ArrowRight, Bot, Building2, Megaphone, Palette, Rocket, ShoppingBag, Sparkles, User, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Badge, Button } from "@fliptrybe/ui";
import { SelectCard, ProvisionStep } from "@fliptrybe/ui/components";

type Step = "role" | "ai" | "provision" | "home";

const ROLES = [
  { id: "creator", label: "Creator", desc: "I create content and grow audiences", icon: Palette },
  { id: "business", label: "Business owner", desc: "I want to promote my products or services", icon: ShoppingBag },
  { id: "agency", label: "Agency", desc: "I manage campaigns for multiple clients", icon: Building2 },
  { id: "marketer", label: "Marketer", desc: "I run ads and growth experiments", icon: Megaphone },
];

const PROVISION_STEPS = [
  { label: "Creating workspace", detail: "Setting up your environment" },
  { label: "Configuring wallet", detail: "Enabling Naira deposits & holds" },
  { label: "AI studio ready", detail: "Campaign intelligence active" },
  { label: "Growth services", detail: "Marketplace connected" },
  { label: "You're all set", detail: "Welcome to FlipTrybe" },
];

const AI_MESSAGES = [
  { role: "ai" as const, text: "Welcome! I'm your FlipTrybe AI assistant. I'll help you get set up." },
  { role: "ai" as const, text: "Based on your role, I've customized your workspace with the right tools and defaults." },
  { role: "ai" as const, text: "Your workspace is configured. Let me set up your wallet, campaign space, and AI studio now." },
];

const QUICK_ACTIONS = [
  { label: "Create a campaign", href: "/campaigns/new", icon: Sparkles, desc: "Launch your first AI-powered campaign" },
  { label: "Fund your wallet", href: "/billing", icon: Zap, desc: "Add funds to start spending on ads" },
  { label: "Explore growth services", href: "/growth-services", icon: Rocket, desc: "Browse services to grow your brand" },
  { label: "Complete business setup", href: "/onboarding", icon: Building2, desc: "Finish your workspace configuration" },
];

export default function WelcomePage() {
  const [step, setStep] = useState<Step>("role");
  const [selectedRole, setSelectedRole] = useState<string>();
  const [provisionIndex, setProvisionIndex] = useState(0);

  function handleRoleContinue() {
    if (!selectedRole) return;
    setStep("ai");
  }

  function handleAiContinue() {
    setStep("provision");
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i >= PROVISION_STEPS.length) {
        clearInterval(interval);
        setTimeout(() => setStep("home"), 600);
      } else {
        setProvisionIndex(i);
      }
    }, 800);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ft-bg-base)] px-4 py-10 text-[var(--ft-text-primary)]">
      <div className="w-full max-w-2xl">
        <AnimatePresence mode="wait">
          {/* Step 1: Role selection */}
          {step === "role" && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-8"
              exit={{ opacity: 0, y: -20 }}
              initial={{ opacity: 0, y: 20 }}
              key="role"
            >
              <div className="text-center">
                <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-[var(--ft-accent)]/10">
                  <User className="size-7 text-[var(--ft-accent)]" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">How will you use FlipTrybe?</h1>
                <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
                  This helps us customize your workspace and AI recommendations
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {ROLES.map((role) => (
                  <SelectCard
                    active={selectedRole === role.id}
                    description={role.desc}
                    icon={<role.icon className="size-5" />}
                    key={role.id}
                    onClick={() => setSelectedRole(role.id)}
                    title={role.label}
                  />
                ))}
              </div>

              <Button
                className="mx-auto h-11 w-full max-w-xs justify-center"
                disabled={!selectedRole}
                onClick={handleRoleContinue}
              >
                Continue
                <ArrowRight className="size-4" />
              </Button>
            </motion.div>
          )}

          {/* Step 2: AI conversation */}
          {step === "ai" && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-6"
              exit={{ opacity: 0, y: -20 }}
              initial={{ opacity: 0, y: 20 }}
              key="ai"
            >
              <div className="text-center">
                <Badge tone="info">AI Setup</Badge>
                <h2 className="mt-4 text-2xl font-bold">Setting up your workspace</h2>
                <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
                  FlipTrybe AI is configuring your experience
                </p>
              </div>

              <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
                <div className="grid gap-4">
                  {AI_MESSAGES.map((msg, i) => (
                    <motion.div
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-3"
                      initial={{ opacity: 0, x: -10 }}
                      key={i}
                      transition={{ delay: i * 0.5 }}
                    >
                      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--ft-accent)]/10">
                        <Bot className="size-4 text-[var(--ft-accent)]" />
                      </div>
                      <div className="rounded-[var(--radius-lg)] bg-[var(--ft-bg-surface)] px-4 py-3 text-sm leading-relaxed">
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}

                  <motion.div
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 text-sm text-[var(--ft-text-muted)]"
                    initial={{ opacity: 0 }}
                    transition={{ delay: 1.5 }}
                  >
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      className="size-2 rounded-full bg-[var(--ft-accent)]"
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                    AI is thinking...
                  </motion.div>
                </div>
              </div>

              <Button
                className="mx-auto h-11 w-full max-w-xs justify-center"
                onClick={handleAiContinue}
              >
                <Sparkles className="size-4" />
                Set up my workspace
              </Button>
            </motion.div>
          )}

          {/* Step 3: Provisioning */}
          {step === "provision" && (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className="grid gap-8"
              initial={{ opacity: 0, scale: 0.95 }}
              key="provision"
            >
              <div className="text-center">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-[var(--ft-accent)]/10"
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="size-7 text-[var(--ft-accent)]" />
                </motion.div>
                <h2 className="text-2xl font-bold">Provisioning your workspace</h2>
                <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">This takes just a moment</p>
              </div>

              <div className="mx-auto w-full max-w-md rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
                <div className="grid gap-3">
                  {PROVISION_STEPS.map((ps, i) => (
                    <ProvisionStep
                      active={i === provisionIndex}
                      done={i < provisionIndex}
                      key={ps.label}
                      label={ps.label}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 4: Welcome home */}
          {step === "home" && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-8"
              initial={{ opacity: 0, y: 20 }}
              key="home"
            >
              <div className="text-center">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-[var(--ft-green)]/10"
                  transition={{ duration: 0.6 }}
                >
                  <Rocket className="size-7 text-[var(--ft-green)]" />
                </motion.div>
                <h1 className="text-3xl font-bold tracking-tight">You're all set!</h1>
                <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
                  Your FlipTrybe workspace is ready. Here's what you can do next.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {QUICK_ACTIONS.map((action) => (
                  <a
                    className="group flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-4 transition hover:border-[var(--ft-accent)]/40 hover:shadow-[var(--shadow-md)]"
                    href={action.href}
                    key={action.label}
                  >
                    <div className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--ft-accent)]/10 transition group-hover:bg-[var(--ft-accent)] group-hover:text-[var(--ft-text-inverse)]">
                      <action.icon className="size-5 text-[var(--ft-accent)] group-hover:text-inherit" />
                    </div>
                    <div>
                      <div className="font-medium">{action.label}</div>
                      <div className="mt-0.5 text-sm text-[var(--ft-text-secondary)]">{action.desc}</div>
                    </div>
                  </a>
                ))}
              </div>

              <a className="mx-auto" href="/studio">
                <Button className="h-11 justify-center">
                  <Sparkles className="size-4" />
                  Go to Studio
                </Button>
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
