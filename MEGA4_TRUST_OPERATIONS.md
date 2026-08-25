# MEGA 4: Trust, Operations & Communication

This slice establishes the shared customer trust contract for operational notifications and recovery surfaces.

## Safety guarantees

- Notification preferences are scoped by workspace and event name.
- Security/system notifications can bypass channel opt-outs through the explicit `mandatory` flag.
- Operational notification vocabulary is centralized and test-covered.
- Customer recovery surfaces distinguish unknown financial delivery from confirmed failure.
- Verification guidance exposes pending, approved, rejected, expired, requires-action and restricted states without inventing provider or regulatory claims.

## Delivery contract

Operational notifications should be emitted after durable state transitions, with idempotency keys retained by the notification service. Provider delivery and production credentials remain deployment concerns.
