# OPS Evidence Manifest

Date: 2026-06-05

Purpose: convert existing project artifacts into readiness-ledger evidence pointers for `corepack pnpm ops:evidence`.

The readiness system does not inspect files. It only reads `OPS_001_EVIDENCE` through `OPS_110_EVIDENCE` and optional `OPS_001_STATUS` through `OPS_110_STATUS`. This manifest is the source map used by `OPS_READINESS_ENV_TEMPLATE.env`.

## Status Rules

| Status | Meaning in this manifest | Counts as complete in `ops:evidence` |
| --- | --- | --- |
| `evidence-captured` | A concrete screenshot, JSON response, deployed check, or report artifact exists for the exact task. | Yes |
| `local-complete` | Code, tests, runbook, or local verification exists, but production/operator evidence is still required before launch. | Yes |
| `in-progress` | Partial evidence exists but does not satisfy the task. | No |
| `external-blocked` | Requires provider dashboard, Render dashboard, live credential, or production workflow evidence not available in the repo. | No |
| `no-go` | Existing evidence proves the task failed or is blocked. | No |
| `missing` | No usable evidence source was found. | No |

## Evidence Inventory

| Source | Evidence captured |
| --- | --- |
| `docs/E2E_VALIDATION_REPORT.md` | API health, Growth dev-header API flow, screenshots, and explicit failed registration/DB-backed journey evidence. |
| `docs/e2e-evidence/*` | JSON responses and screenshots for advertiser, operator, admin, and Growth surfaces. |
| `FINAL_LAUNCH_REVIEW.md` | Deployed smoke summary, old/new readiness score, and launch blockers. |
| `PRODUCTION_DIVERGENCE_REPORT.md` | Production divergence proof for Growth 404s and public admin overview. |
| `SECURITY_AUDIT_REPORT.md` | Security risk register and public-route findings. |
| `AUTHORIZATION_REMEDIATION_REPORT.md` | Local R1 guard/RBAC remediation, endpoint inventory, role matrix, and tests. |
| `FINANCIAL_REMEDIATION_REPORT.md` | Wallet, invoice, Korapay, hold, capture, replay, and financial-integrity remediation evidence. |
| `GROWTH_HARDENING_REPORT.md` | Growth payment gating, duplicate prevention, supplier failure, refund, and monitoring hardening evidence. |
| `DEPLOYMENT_HARDENING_REPORT.md` | Render/env/build/worker/backup audit and local build/test evidence. |
| `docs/OPERATIONS.md` | Incident, payment reconciliation, Korapay webhook, backup, restore, queue, and rollback runbooks. |
| `docs/MANAGED_ADS_MONITORING_RUNBOOK.md` | Monitoring cadence and alert/runbook definitions. |
| `docs/MANAGED_ADS_PRODUCTION_TASKS.md` | Canonical OPS task inventory and owner map. |
| `docs/CAMPAIGN_CONTROLS.md` | Campaign control policy evidence. |
| `docs/OPERATOR_WORKFLOW_REPORT.md` | Operator workflow/UI evidence summary. |

## OPS Item Mapping

| OPS | Owner | Status | Evidence source | Evidence note |
| --- | --- | --- | --- | --- |
| OPS-001 | Deploy owner | missing | `FINAL_LAUNCH_REVIEW.md` | Owner roster remains uncaptured. |
| OPS-002 | Deploy owner | external-blocked | `DEPLOYMENT_HARDENING_REPORT.md` | Render access confirmation requires dashboard/operator proof. |
| OPS-003 | Campaign ops owner | no-go | `docs/E2E_VALIDATION_REPORT.md` | Admin/operator registration returned 500, so sign-in evidence was not captured. |
| OPS-004 | API owner | local-complete | `AUTHORIZATION_REMEDIATION_REPORT.md` | Role matrix, route annotations, guard tests, and local authorization remediation exist. |
| OPS-005 | Payments owner | external-blocked | `FINAL_LAUNCH_REVIEW.md` | Korapay dashboard access was not captured. |
| OPS-006 | Media owner | external-blocked | `FINAL_LAUNCH_REVIEW.md` | Cloudinary dashboard access was not captured. |
| OPS-007 | Support owner | missing | `docs/LAUNCH_READINESS_TRACKER_R4.md` | Production support inbox/channel remains missing. |
| OPS-008 | Rollback owner | external-blocked | `DEPLOYMENT_HARDENING_REPORT.md` | Render rollback access requires dashboard/operator proof. |
| OPS-009 | Deploy owner | missing | `docs/LAUNCH_READINESS_TRACKER_R4.md` | Launch channel link was not captured. |
| OPS-010 | Support owner | missing | `docs/LAUNCH_READINESS_TRACKER_R4.md` | Incident channel link was not captured. |
| OPS-011 | API owner | local-complete | `DEPLOYMENT_HARDENING_REPORT.md` | API build was locally verified. |
| OPS-012 | Worker owner | local-complete | `DEPLOYMENT_HARDENING_REPORT.md` | Worker build and tests were locally verified. |
| OPS-013 | Deploy owner | local-complete | `DEPLOYMENT_HARDENING_REPORT.md` | Web static export/build was locally verified. |
| OPS-014 | Deploy owner | local-complete | `DEPLOYMENT_HARDENING_REPORT.md` | Admin static export/build was locally verified. |
| OPS-015 | API owner | external-blocked | `DEPLOYMENT_HARDENING_REPORT.md` | Live Render env value proof was not captured. |
| OPS-016 | API owner | external-blocked | `DEPLOYMENT_HARDENING_REPORT.md` | Live Postgres/Redis target proof was not captured. |
| OPS-017 | Media owner | local-complete | `FINAL_LAUNCH_REVIEW.md` | API health reported `cloudinary-storage`; live dashboard proof remains external. |
| OPS-018 | Media owner | local-complete | `DEPLOYMENT_HARDENING_REPORT.md` | Cloudinary env contract and mock-storage kill switch are documented. |
| OPS-019 | Payments owner | local-complete | `FINAL_LAUNCH_REVIEW.md` | API health reported Korapay provider; live dashboard proof remains external. |
| OPS-020 | Deploy owner | local-complete | `DEPLOYMENT_HARDENING_REPORT.md` | Web/admin env review evidence exists at repo/config level. |
| OPS-021 | API owner | local-complete | `AUTHORIZATION_REMEDIATION_REPORT.md` | Auth context now resolves DB-backed role and permission values. |
| OPS-022 | Payments owner | local-complete | `FINANCIAL_REMEDIATION_REPORT.md` | Financial guardrails and wallet consistency checks exist in code/tests. |
| OPS-023 | Deploy owner | external-blocked | `DEPLOYMENT_HARDENING_REPORT.md` | Backup execution evidence is explicitly missing. |
| OPS-024 | API owner | in-progress | `FINANCIAL_REMEDIATION_REPORT.md` | Migration/constraints exist, but disposable Postgres dry-run evidence is not captured. |
| OPS-025 | Deploy owner | external-blocked | `PRODUCTION_DIVERGENCE_REPORT.md` | Production deployed artifact differs from current workspace; commit proof is required. |
| OPS-026 | Campaign ops owner | missing | `docs/MANAGED_ADS_PRODUCTION_TASKS.md` | Default operator roster was not captured. |
| OPS-027 | Campaign ops owner | local-complete | `docs/OPERATOR_WORKFLOW_REPORT.md` | Operator workflow/rule documentation exists. |
| OPS-028 | Campaign ops owner | local-complete | `docs/MANAGED_ADS_MONITORING_RUNBOOK.md` | Queue/ops cadence documentation exists. |
| OPS-029 | Payments owner | local-complete | `docs/OPERATIONS.md` | Payment follow-up/reconciliation cadence is documented. |
| OPS-030 | Campaign ops owner | local-complete | `docs/MANAGED_ADS_MONITORING_RUNBOOK.md` | Report/ops cadence documentation exists. |
| OPS-031 | Campaign ops owner | evidence-captured | `docs/e2e-evidence/screenshot-operator-queue.png` | Operator review queue screenshot exists. |
| OPS-032 | Campaign ops owner | no-go | `docs/E2E_VALIDATION_REPORT.md` | Admin/operator authenticated action flow was blocked by registration/DB issue. |
| OPS-033 | Campaign ops owner | no-go | `docs/E2E_VALIDATION_REPORT.md` | Internal note API action was not completed. |
| OPS-034 | Campaign ops owner | no-go | `docs/E2E_VALIDATION_REPORT.md` | Client-visible timeline update was not completed. |
| OPS-035 | Campaign ops owner | no-go | `docs/E2E_VALIDATION_REPORT.md` | Admin status matrix was not completed against DB-backed campaign data. |
| OPS-036 | Campaign ops owner | local-complete | `docs/CAMPAIGN_CONTROLS.md` | Campaign control policy exists locally. |
| OPS-037 | API owner | in-progress | `docs/e2e-evidence/screenshot-operator-activity.png` | Activity UI exists, but write-generated audit entry IDs were not captured. |
| OPS-038 | Campaign ops owner | missing | `docs/MANAGED_ADS_PRODUCTION_TASKS.md` | Bulk action failure behavior evidence was not found. |
| OPS-039 | Campaign ops owner | evidence-captured | `docs/e2e-evidence/screenshot-operator-placement-reporting-detail.png` | Operator detail route screenshot exists. |
| OPS-040 | Campaign ops owner | missing | `docs/E2E_VALIDATION_REPORT.md` | Mobile admin queue screenshot was not captured. |
| OPS-041 | API owner | no-go | `docs/E2E_VALIDATION_REPORT.md` | Production-like signup/login failed in local E2E with registration 500. |
| OPS-042 | Support owner | no-go | `docs/E2E_VALIDATION_REPORT.md` | Business profile completion was blocked by registration/DB issue. |
| OPS-043 | Support owner | in-progress | `docs/e2e-evidence/screenshot-advertiser-onboarding.png` | Onboarding UI screenshot exists, but blocking behavior was not verified. |
| OPS-044 | API owner | no-go | `docs/E2E_VALIDATION_REPORT.md` | Campaign creation/submission was blocked by auth/database failure. |
| OPS-045 | Support owner | in-progress | `docs/e2e-evidence/screenshot-advertiser-campaign-new.png` | Intake UI screenshot exists, but submission confirmation was not captured. |
| OPS-046 | Support owner | evidence-captured | `docs/e2e-evidence/screenshot-advertiser-campaigns.png` | Campaign list screenshot exists. |
| OPS-047 | API owner | no-go | `docs/E2E_VALIDATION_REPORT.md` | Client/admin comparison was not completed. |
| OPS-048 | API owner | evidence-captured | `docs/e2e-evidence/screenshot-advertiser-reports.png` | Client reports route screenshot exists. |
| OPS-049 | Payments owner | in-progress | `docs/e2e-evidence/screenshot-advertiser-billing.png` | Billing UI screenshot exists, but invoice context and financial-history flow were not proven. |
| OPS-050 | Support owner | missing | `docs/E2E_VALIDATION_REPORT.md` | Mobile bottom navigation proof was not captured. |
| OPS-051 | Campaign ops owner | external-blocked | `docs/LAUNCH_READINESS_TRACKER_R4.md` | TikTok Ads Manager access requires external proof. |
| OPS-052 | Campaign ops owner | external-blocked | `docs/LAUNCH_READINESS_TRACKER_R4.md` | Meta Ads Manager access requires external proof. |
| OPS-053 | Campaign ops owner | external-blocked | `docs/LAUNCH_READINESS_TRACKER_R4.md` | Page access requires external proof. |
| OPS-054 | Campaign ops owner | local-complete | `docs/MANAGED_ADS_EVIDENCE_PACKET.md` | Manual launch naming/convention guidance exists. |
| OPS-055 | Campaign ops owner | local-complete | `docs/MANAGED_ADS_EVIDENCE_PACKET.md` | UTM/link tagging guidance exists. |
| OPS-056 | Payments owner | local-complete | `FINANCIAL_REMEDIATION_REPORT.md` | Spend/budget guardrails exist at code/report level. |
| OPS-057 | Media owner | local-complete | `docs/MANAGED_ADS_EVIDENCE_PACKET.md` | Proof capture standard guidance exists. |
| OPS-058 | Campaign ops owner | local-complete | `docs/OPERATIONS.md` | Incident/escalation path is documented. |
| OPS-059 | Campaign ops owner | local-complete | `docs/CAMPAIGN_CONTROLS.md` | Manual placement/control guidance exists. |
| OPS-060 | Campaign ops owner | local-complete | `GROWTH_HARDENING_REPORT.md` | Supplier execution now requires reservation and guardrails before live execution. |
| OPS-061 | Payments owner | external-blocked | `FINAL_LAUNCH_REVIEW.md` | Production Korapay payment creation was not captured. |
| OPS-062 | Payments owner | external-blocked | `FINAL_LAUNCH_REVIEW.md` | Live/sandbox payment completion was not captured. |
| OPS-063 | Payments owner | external-blocked | `FINAL_LAUNCH_REVIEW.md` | Live webhook wallet credit evidence was not captured. |
| OPS-064 | Payments owner | local-complete | `FINANCIAL_REMEDIATION_REPORT.md` | Webhook replay/idempotency remediation and tests exist locally. |
| OPS-065 | Payments owner | local-complete | `FINANCIAL_REMEDIATION_REPORT.md` | Cross-record payment linkage is remediated locally. |
| OPS-066 | Payments owner | local-complete | `FINANCIAL_REMEDIATION_REPORT.md` | Budget hold creation guardrails exist. |
| OPS-067 | Payments owner | local-complete | `FINANCIAL_REMEDIATION_REPORT.md` | Hold release guardrails exist. |
| OPS-068 | Payments owner | local-complete | `FINANCIAL_REMEDIATION_REPORT.md` | Capture/debit guardrails exist. |
| OPS-069 | Payments owner | local-complete | `FINANCIAL_REMEDIATION_REPORT.md` | Insufficient/invalid money guardrails and tests exist. |
| OPS-070 | Payments owner | local-complete | `docs/OPERATIONS.md` | Payment reconciliation/refund playbook exists. |
| OPS-071 | Media owner | external-blocked | `FINAL_LAUNCH_REVIEW.md` | Live image upload was not captured. |
| OPS-072 | Media owner | external-blocked | `FINAL_LAUNCH_REVIEW.md` | Live video upload was not captured. |
| OPS-073 | Media owner | local-complete | `DEPLOYMENT_HARDENING_REPORT.md` | Media upload policy/env guardrails exist locally. |
| OPS-074 | Media owner | local-complete | `DEPLOYMENT_HARDENING_REPORT.md` | Unsupported MIME/media policy guardrails exist locally. |
| OPS-075 | Media owner | local-complete | `FINAL_LAUNCH_REVIEW.md` | Cloudinary signature tests passed locally. |
| OPS-076 | Campaign ops owner | in-progress | `docs/e2e-evidence/screenshot-operator-placement-reporting-detail.png` | Proof UI evidence exists, but client-visible marking was not verified. |
| OPS-077 | API owner | in-progress | `docs/E2E_VALIDATION_REPORT.md` | Client/admin proof visibility comparison was not completed. |
| OPS-078 | Campaign ops owner | evidence-captured | `docs/e2e-evidence/screenshot-operator-reports.png` | Admin/operator reports UI screenshot exists. |
| OPS-079 | Campaign ops owner | missing | `docs/MANAGED_ADS_PRODUCTION_TASKS.md` | Reviewer approval evidence was not found. |
| OPS-080 | Support owner | in-progress | `docs/e2e-evidence/screenshot-advertiser-reports.png` | Client report UI exists, but publish/notification path was not captured. |
| OPS-081 | Support owner | evidence-captured | `FINAL_LAUNCH_REVIEW.md` | Deployed smoke passed the web notifications route. |
| OPS-082 | Support owner | missing | `docs/MANAGED_ADS_PRODUCTION_TASKS.md` | Admin notification list proof was not found. |
| OPS-083 | Support owner | missing | `docs/LAUNCH_READINESS_TRACKER_R4.md` | Support inbox/channel is missing. |
| OPS-084 | Support owner | missing | `docs/MANAGED_ADS_PRODUCTION_TASKS.md` | Brief received canned response was not found. |
| OPS-085 | Support owner | missing | `docs/MANAGED_ADS_PRODUCTION_TASKS.md` | Invoice due canned response was not found. |
| OPS-086 | Support owner | missing | `docs/MANAGED_ADS_PRODUCTION_TASKS.md` | Campaign live canned response was not found. |
| OPS-087 | Support owner | missing | `docs/MANAGED_ADS_PRODUCTION_TASKS.md` | Report published canned response was not found. |
| OPS-088 | Support owner | local-complete | `docs/OPERATIONS.md` | Payment mismatch incident response is documented. |
| OPS-089 | Support owner | local-complete | `docs/OPERATIONS.md` | External rejection/incident response is documented. |
| OPS-090 | Support owner | local-complete | `DEPLOYMENT_HARDENING_REPORT.md` | Provider/env review evidence exists; no WhatsApp live path was enabled in evidence. |
| OPS-091 | API owner | external-blocked | `DEPLOYMENT_HARDENING_REPORT.md` | Render API alert proof is missing. |
| OPS-092 | Worker owner | external-blocked | `DEPLOYMENT_HARDENING_REPORT.md` | Worker restart alert proof is missing. |
| OPS-093 | Deploy owner | external-blocked | `DEPLOYMENT_HARDENING_REPORT.md` | Postgres capacity alert proof is missing. |
| OPS-094 | Worker owner | external-blocked | `DEPLOYMENT_HARDENING_REPORT.md` | Redis capacity alert proof is missing. |
| OPS-095 | Payments owner | local-complete | `docs/OPERATIONS.md` | Payment mismatch reconciliation cadence is documented. |
| OPS-096 | Worker owner | local-complete | `docs/MANAGED_ADS_MONITORING_RUNBOOK.md` | Queue-depth manual cadence/runbook exists. |
| OPS-097 | Media owner | local-complete | `docs/MANAGED_ADS_MONITORING_RUNBOOK.md` | Failed upload review cadence/runbook exists. |
| OPS-098 | API owner | local-complete | `docs/MANAGED_ADS_MONITORING_RUNBOOK.md` | API error review cadence/runbook exists. |
| OPS-099 | Deploy owner | external-blocked | `DEPLOYMENT_HARDENING_REPORT.md` | Deploy failure alert proof is missing. |
| OPS-100 | Support owner | missing | `docs/LAUNCH_READINESS_TRACKER_R4.md` | Incident contact path/signoff is missing. |
| OPS-101 | Deploy owner | no-go | `docs/E2E_VALIDATION_REPORT.md` | Complete production smoke campaign was not run; E2E was blocked. |
| OPS-102 | Support owner | no-go | `docs/E2E_VALIDATION_REPORT.md` | UI audit found financial-history runtime error and unauthenticated warnings. |
| OPS-103 | Campaign ops owner | evidence-captured | `docs/e2e-evidence/screenshot-admin-overview-financial-review.png` | Admin desktop screenshot exists. |
| OPS-104 | Support owner | missing | `docs/E2E_VALIDATION_REPORT.md` | Mobile 375px proof was not captured. |
| OPS-105 | Rollback owner | external-blocked | `PRODUCTION_DIVERGENCE_REPORT.md` | Deployed commit/rollback target proof is missing and production diverges. |
| OPS-106 | Rollback owner | local-complete | `docs/OPERATIONS.md` | Rollback/recovery order is documented. |
| OPS-107 | Payments owner | local-complete | `docs/OPERATIONS.md` | Reconciliation plan is documented. |
| OPS-108 | Support owner | local-complete | `docs/OPERATIONS.md` | Incident/customer-impact communication process is documented. |
| OPS-109 | Deploy owner | missing | `FINAL_LAUNCH_REVIEW.md` | Final owner signoff was not captured. |
| OPS-110 | Deploy owner | missing | `FINAL_LAUNCH_REVIEW.md` | Config freeze notice was not captured. |

## Completion Summary

| Status | Count |
| --- | ---: |
| `local-complete` | 43 |
| `evidence-captured` | 7 |
| `external-blocked` | 22 |
| `no-go` | 11 |
| `in-progress` | 9 |
| `missing` | 18 |

Complete statuses: 50/110.

Open statuses: 60/110.

