# MEGA 4: Trust + Operations + Communication

This mega-build establishes a shared operational contract for customer-visible verification, security, transaction, card, gift-card, travel, campaign and support events.

## Safety rules

- `needs_review`, `verification_required`, and `restricted` are actionable states.
- Ambiguous provider outcomes must remain visible to operations and must never be presented to customers as successful.
- Customer notifications must be derived from durable state, not optimistic UI state.
- Provider references are preserved for reconciliation and support.
- Security events are distinct from marketing notifications.
- Customer-facing copy must explain what happened, what the customer can do next, and when support is required.

## Event families

Transaction, verification, security, card, gift card, travel, campaign, and support events share one event vocabulary while retaining product-specific actions.

## Operational workflow

Customer event → durable operational state → notification → actionable destination → audit trail.

## Definition of done

- Shared state vocabulary exists.
- Actionable states are explicit.
- Customer notifications cannot imply success before durable completion.
- Verification and restriction states have recovery destinations.
- Support can identify the originating operation/provider reference.
- Security notifications are separated from promotional messaging.
