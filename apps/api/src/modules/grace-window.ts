import type { EnvelopeStatus, ResponseEnvelope } from "@fliptrybe/types";

const DEFAULT_GRACE_WINDOW_MS = 3000;

/**
 * Wraps a mutating operation in the shared response envelope. If the operation
 * settles within the grace window, its outcome (mapped by `toStatus`) is returned
 * immediately. If it's still running when the window elapses, a `"pending"` envelope
 * is returned right away and the operation keeps running in the background — the
 * caller is expected to have already persisted a resource the client can poll (e.g.
 * an order row created before the provider call), since `resourceId` is fixed up
 * front and `data` on the pending response is always null.
 *
 * Failures are not swallowed: if the operation rejects after the window has already
 * returned "pending", the rejection is logged via `onBackgroundError` (never thrown —
 * there's no request left to throw into). If it rejects before the window elapses,
 * the returned promise rejects normally so the controller's existing error handling
 * applies unchanged.
 */
export async function withGraceWindow<T>(params: {
  resourceId: string;
  run: () => Promise<T>;
  toStatus: (result: T) => EnvelopeStatus;
  graceWindowMs?: number;
  onBackgroundError?: (error: unknown) => void;
}): Promise<ResponseEnvelope<T>> {
  const { resourceId, run, toStatus, graceWindowMs = DEFAULT_GRACE_WINDOW_MS, onBackgroundError } = params;

  const operation = run();

  let timedOut = false;
  const timeout = new Promise<"timeout">((resolve) => {
    setTimeout(() => {
      timedOut = true;
      resolve("timeout");
    }, graceWindowMs).unref();
  });

  const winner = await Promise.race([operation, timeout]);

  if (winner === "timeout") {
    operation.catch((error) => {
      if (timedOut) onBackgroundError?.(error);
    });
    return { resourceId, status: "pending", data: null };
  }

  const result = winner as T;
  return { resourceId, status: toStatus(result), data: result };
}

/**
 * Wraps an already-settled result in the shared response envelope. Use this instead
 * of `withGraceWindow` when the operation is a single synchronous unit (e.g. one DB
 * transaction, no external provider call) — there's nothing to race, so a resource id
 * chosen up front isn't needed either.
 */
export function toEnvelope<T>(params: {
  resourceId: string;
  data: T;
  toStatus: (result: T) => EnvelopeStatus;
}): ResponseEnvelope<T> {
  return { resourceId: params.resourceId, status: params.toStatus(params.data), data: params.data };
}
