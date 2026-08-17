import { afterEach, describe, expect, it, vi } from "vitest";

import { apiRequest, fetchCurrentSession } from "./api-client";

/**
 * /v1/auth/session answers a signed-out caller with 200 and a zero-length body
 * rather than a 401 — it is @Public, and the web app calls it to ask "am I
 * signed in?". response.json() throws a SyntaxError on an empty body, so that
 * normal case used to surface as a parse error and left a dead token in
 * localStorage forever.
 */
// body must be null for 204 — the Response constructor rejects a body on a
// null-body status, which is not something apiRequest ever sees in a browser.
function respondWith(body: string | null, init: ResponseInit = { status: 200 }) {
  const fetcher = vi.fn(() => Promise.resolve(new Response(body, init)));
  vi.stubGlobal("fetch", fetcher);

  return fetcher;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiRequest", () => {
  it("returns undefined for a 200 with an empty body", async () => {
    respondWith("");

    await expect(apiRequest("/auth/session")).resolves.toBeUndefined();
  });

  it("returns undefined for a body that is only whitespace", async () => {
    respondWith("\n  ");

    await expect(apiRequest("/auth/session")).resolves.toBeUndefined();
  });

  it("still parses a normal JSON body", async () => {
    respondWith(JSON.stringify({ ok: true }));

    await expect(apiRequest("/anything")).resolves.toEqual({ ok: true });
  });

  it("still returns undefined on 204", async () => {
    respondWith(null, { status: 204 });

    await expect(apiRequest("/anything")).resolves.toBeUndefined();
  });

  it("still raises errors for a non-2xx response", async () => {
    respondWith(JSON.stringify({ message: "Nope." }), { status: 403 });

    await expect(apiRequest("/anything")).rejects.toThrow("Nope.");
  });
});

describe("fetchCurrentSession", () => {
  it("resolves to undefined when signed out rather than throwing", async () => {
    respondWith("");

    await expect(fetchCurrentSession()).resolves.toBeUndefined();
  });

  it("resolves to undefined when the payload carries no user id", async () => {
    // normalizeAuthPayload substitutes a placeholder user rather than failing,
    // so presence of the object is not enough to call someone signed in.
    respondWith(JSON.stringify({ workspace: { id: "w1", name: "W", defaultCurrency: "NGN" } }));

    await expect(fetchCurrentSession()).resolves.toBeUndefined();
  });

  it("returns the session when one is actually present", async () => {
    respondWith(
      JSON.stringify({
        user: { id: "u1", name: "Tunde", username: "tunde" },
        workspace: { id: "w1", name: "Tunde's Workspace", defaultCurrency: "NGN" },
        role: "OWNER"
      })
    );

    await expect(fetchCurrentSession()).resolves.toMatchObject({
      user: { id: "u1", username: "tunde" },
      role: "OWNER"
    });
  });
});
