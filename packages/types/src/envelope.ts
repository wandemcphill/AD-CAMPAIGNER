// Shared response shape for mutating endpoints across every vertical (VTU, virtual
// numbers, gift cards, ...). Keeps the client-facing contract identical whether the
// underlying operation resolved synchronously or is still running behind a provider
// call — see the "grace window" pattern in apps/api's withGraceWindow.
export const envelopeStatuses = ["active", "pending", "failed"] as const;
export type EnvelopeStatus = (typeof envelopeStatuses)[number];

export interface ResponseEnvelope<T> {
  resourceId: string;
  status: EnvelopeStatus;
  data: T | null;
}
