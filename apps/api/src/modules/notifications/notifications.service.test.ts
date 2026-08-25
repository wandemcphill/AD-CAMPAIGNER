/* Test doubles (hand-rolled Prisma clients, vi.fn() spies) are untyped by
   design — same disable block platform.service.test.ts uses. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@fliptrybe/database";

import { PrismaService } from "../prisma.service";
import type { QueueProducerService } from "../queue-producer.service";
import { NotificationsService } from "./notifications.service";

function fakeQueueProducer() {
  return {
    enqueueNotificationDispatch: vi.fn(() =>
      Promise.resolve({ enqueued: true, queue: "notifications", jobId: "job_1" })
    )
  } as unknown as QueueProducerService;
}

function fakePrisma(
  overrides: {
    users?: Record<string, { email?: string | null; phone?: string | null }>;
    preferences?: Record<string, { workspaceId?: string; eventName?: string; email?: boolean; sms?: boolean; whatsapp?: boolean }>;
    existingIdempotencyKeys?: Set<string>;
  } = {}
) {
  const created: any[] = [];
  const idempotencyKeys = overrides.existingIdempotencyKeys ?? new Set<string>();

  const client = {
    notification: {
      create: vi.fn(({ data }: { data: any }) => {
        if (data.idempotencyKey && idempotencyKeys.has(data.idempotencyKey)) {
          throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "test"
          } as never);
        }
        if (data.idempotencyKey) idempotencyKeys.add(data.idempotencyKey);
        const row = { id: `ntf_${created.length + 1}`, ...data };
        created.push(row);
        return Promise.resolve(row);
      })
    },
    user: {
      findUnique: vi.fn(({ where: { id } }: { where: { id: string } }) =>
        Promise.resolve(overrides.users?.[id] ?? null)
      )
    },
    notificationPreference: {
      findFirst: vi.fn(({ where }: { where: { userId: string; workspaceId?: string; eventName: string } }) => {
        const pref = overrides.preferences?.[where.userId];
        if (!pref) return Promise.resolve(null);
        if (pref.workspaceId && pref.workspaceId !== where.workspaceId) return Promise.resolve(null);
        if (pref.eventName && pref.eventName !== where.eventName) return Promise.resolve(null);
        return Promise.resolve({ email: true, sms: true, whatsapp: false, ...pref });
      })
    }
  };

  return { prisma: new PrismaService(client as any), created, client };
}

describe("NotificationsService", () => {
  it("creates an IN_APP notification for an authenticated user without enqueueing a dispatch job", async () => {
    const { prisma, created } = fakePrisma();
    const queueProducer = fakeQueueProducer();
    const service = new NotificationsService(prisma, queueProducer);

    const results = await service.send({
      workspaceId: "ws_1",
      userId: "user_1",
      channels: ["IN_APP"],
      content: { title: "Hello", body: "World" },
      idempotencyKey: "evt_1"
    });

    expect(results).toEqual([{ channel: "IN_APP", outcome: "created", notificationId: "ntf_1" }]);
    expect(created[0]).toMatchObject({ channel: "IN_APP", status: "DELIVERED" });
    expect(queueProducer.enqueueNotificationDispatch).not.toHaveBeenCalled();
  });

  it("resolves the phone from the User row and enqueues an SMS dispatch job", async () => {
    const { prisma } = fakePrisma({ users: { user_1: { phone: "+2348011112222" } } });
    const queueProducer = fakeQueueProducer();
    const service = new NotificationsService(prisma, queueProducer);

    const results = await service.send({
      workspaceId: "ws_1",
      userId: "user_1",
      channels: ["SMS"],
      template: "otp",
      vars: { reference: "123456" },
      idempotencyKey: "evt_2"
    });

    expect(results[0]).toMatchObject({ channel: "SMS", outcome: "created" });
    expect(queueProducer.enqueueNotificationDispatch).toHaveBeenCalledWith("ntf_1", "SMS");
  });

  it("skips SMS when the user has no phone on file, without throwing", async () => {
    const { prisma } = fakePrisma({ users: { user_1: {} } });
    const queueProducer = fakeQueueProducer();
    const service = new NotificationsService(prisma, queueProducer);

    const results = await service.send({
      workspaceId: "ws_1",
      userId: "user_1",
      channels: ["SMS"],
      template: "otp",
      vars: { reference: "123456" },
      idempotencyKey: "evt_3"
    });

    expect(results[0]).toEqual({ channel: "SMS", outcome: "skipped_no_destination" });
    expect(queueProducer.enqueueNotificationDispatch).not.toHaveBeenCalled();
  });

  it("is idempotent — a second send with the same idempotencyKey reports duplicate, not a second row", async () => {
    const { prisma } = fakePrisma({ users: { user_1: { email: "u@example.com" } } });
    const queueProducer = fakeQueueProducer();
    const service = new NotificationsService(prisma, queueProducer);

    const input = {
      workspaceId: "ws_1",
      userId: "user_1",
      channels: ["EMAIL"] as ["EMAIL"],
      template: "payment_success" as const,
      vars: { amount: "100", currency: "NGN", reference: "ref_1" },
      idempotencyKey: "evt_dup"
    };
    const first = await service.send(input);
    const second = await service.send(input);

    expect(first[0]?.outcome).toBe("created");
    expect(second[0]?.outcome).toBe("duplicate");
    expect(queueProducer.enqueueNotificationDispatch).toHaveBeenCalledTimes(1);
  });

  it("sends to a guest via guestEmail/guestPhone with no userId or IN_APP row", async () => {
    const { prisma, created } = fakePrisma();
    const queueProducer = fakeQueueProducer();
    const service = new NotificationsService(prisma, queueProducer);

    const results = await service.send({
      guestEmail: "guest@example.com",
      guestPhone: "+2348011112222",
      channels: ["IN_APP", "EMAIL", "SMS"],
      template: "transaction_receipt",
      vars: { amount: "500", currency: "NGN", reference: "ref_g1", service: "airtime" },
      idempotencyKey: "guest_evt_1"
    });

    expect(results).toEqual([
      { channel: "IN_APP", outcome: "skipped_no_destination" },
      { channel: "EMAIL", outcome: "created", notificationId: "ntf_1" },
      { channel: "SMS", outcome: "created", notificationId: "ntf_2" }
    ]);
    expect(created[0]).toMatchObject({ guestEmail: "guest@example.com", channel: "EMAIL" });
    expect(created[1]).toMatchObject({ guestPhone: "+2348011112222", channel: "SMS" });
  });

  it("scopes preferences by workspace and eventName instead of applying an unrelated opt-out", async () => {
    const { prisma, client } = fakePrisma({
      users: { user_1: { phone: "+2348011112222" } },
      preferences: { user_1: { workspaceId: "ws_2", eventName: "security_alert", sms: false } }
    });
    const service = new NotificationsService(prisma, fakeQueueProducer());

    const results = await service.send({
      workspaceId: "ws_1",
      userId: "user_1",
      channels: ["SMS"],
      eventName: "transaction_completed",
      content: { title: "Done", body: "Completed" },
      idempotencyKey: "evt_scope"
    });

    expect(results[0]?.outcome).toBe("created");
    expect(client.notificationPreference.findFirst).toHaveBeenCalledWith({
      where: { workspaceId: "ws_1", userId: "user_1", eventName: "transaction_completed" }
    });
  });

  it("respects an explicit SMS opt-out for the matching workspace and event", async () => {
    const { prisma } = fakePrisma({
      users: { user_1: { phone: "+2348011112222" } },
      preferences: { user_1: { workspaceId: "ws_1", eventName: "security_alert", sms: false } }
    });
    const service = new NotificationsService(prisma, fakeQueueProducer());

    const results = await service.send({
      workspaceId: "ws_1",
      userId: "user_1",
      channels: ["SMS"],
      eventName: "security_alert",
      template: "security_alert",
      vars: { status: "New login", date: "today" },
      idempotencyKey: "evt_optout"
    });

    expect(results[0]).toEqual({ channel: "SMS", outcome: "skipped_opted_out" });
  });

  it("allows mandatory security notifications through channel opt-outs", async () => {
    const { prisma } = fakePrisma({
      users: { user_1: { phone: "+2348011112222" } },
      preferences: { user_1: { workspaceId: "ws_1", eventName: "security_alert", sms: false } }
    });
    const service = new NotificationsService(prisma, fakeQueueProducer());

    const results = await service.send({
      workspaceId: "ws_1",
      userId: "user_1",
      channels: ["SMS"],
      eventName: "security_alert",
      template: "security_alert",
      mandatory: true,
      vars: { status: "New login", date: "today" },
      idempotencyKey: "evt_mandatory"
    });

    expect(results[0]?.outcome).toBe("created");
  });

  it("rejects a send with neither a workspace nor guest contact info", async () => {
    const { prisma } = fakePrisma();
    const service = new NotificationsService(prisma, fakeQueueProducer());

    await expect(
      service.send({
        channels: ["EMAIL"],
        template: "otp",
        vars: { reference: "1" },
        idempotencyKey: "evt_invalid"
      })
    ).rejects.toThrow(/requires either workspaceId/);
  });
});