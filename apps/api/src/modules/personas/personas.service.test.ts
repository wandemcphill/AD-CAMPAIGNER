/* Test doubles (hand-rolled Prisma clients, vi.fn() spies) are untyped by
   design — same disable block platform.service.test.ts uses. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma.service";
import { PersonasService } from "./personas.service";

const SCOPE = { workspaceId: "workspace_test", userId: "user_test" };

function buildDb(overrides: Record<string, unknown> = {}) {
  const persona = {
    id: "persona_1",
    workspaceId: "workspace_test",
    name: "Ada",
    type: "SYNTHETIC",
    hasVoice: true,
    hasMotion: false,
    consentedAt: null as Date | null
  };

  return {
    persona: {
      findFirst: vi.fn(() => Promise.resolve(persona)),
      update: vi.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...persona, ...args.data })
      ),
      ...overrides
    },
    auditLog: { create: vi.fn(() => Promise.resolve({})) },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops))
  };
}

describe("PersonasService.markConsented", () => {
  it("stamps consentedAt and writes an audit log entry", async () => {
    const db = buildDb();
    const service = new PersonasService({ client: db } as unknown as PrismaService);

    const result = await service.markConsented("persona_1", SCOPE);

    expect(result.consentedAt).toBeInstanceOf(Date);
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: "workspace_test",
          actorUserId: "user_test",
          action: "persona.consent_granted",
          entityType: "Persona",
          entityId: "persona_1"
        })
      })
    );
  });

  it("is idempotent — does not re-log consent that was already granted", async () => {
    const db = buildDb({
      findFirst: vi.fn(() =>
        Promise.resolve({
          id: "persona_1",
          workspaceId: "workspace_test",
          name: "Ada",
          type: "SYNTHETIC",
          hasVoice: true,
          hasMotion: false,
          consentedAt: new Date("2026-01-01T00:00:00Z")
        })
      )
    });
    const service = new PersonasService({ client: db } as unknown as PrismaService);

    await service.markConsented("persona_1", SCOPE);

    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});
