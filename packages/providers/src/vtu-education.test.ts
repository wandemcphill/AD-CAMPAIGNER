import { describe, expect, it, vi } from "vitest";

import { createTopupWizardAdapter, createSirpDataAdapter } from "./vtu";

/**
 * Exam-PIN purchase response parsing.
 *
 * The PIN *is* the product here — unlike airtime or data, nothing is delivered
 * to a phone number, so if the adapter fails to read the PIN out of the response
 * the customer has paid for nothing. That failure is silent: the order still
 * settles DELIVERED because the provider really did succeed. These tests pin the
 * exact documented response shapes so a field rename cannot quietly resurrect it.
 *
 * Payloads below are the samples from each provider's published docs
 * (TopupWizard /education and SIRP DATA /educational-pins, both 2026-08-15).
 */

function jsonFetcher(payload: unknown, ok = true, status = 200) {
  return vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(payload), {
        status: ok ? status : status,
        headers: { "Content-Type": "application/json" }
      })
    )
  ) as unknown as typeof fetch;
}

describe("TopupWizard purchaseEducation", () => {
  const successPayload = {
    status: "success",
    message: "WAEC pin purchase successful",
    data: {
      pinType: "waec",
      pins: [{ pin: "7y46thfyser", serialNo: "534354543453" }],
      quantity: 1,
      amount: 2500,
      reference: "TW_gdfu7fd6ygds_WAEC",
      clientReference: "Cldsfsgsdgfnm",
      date: "02-09-2021 12:31:39",
      type: "education"
    }
  };

  it("extracts the PIN and serial from data.pins[]", async () => {
    const adapter = createTopupWizardAdapter({
      apiKey: "token",
      fetcher: jsonFetcher(successPayload)
    });

    const result = await adapter.purchaseEducation!({
      examType: "100",
      phoneNumber: "08030000000",
      reference: "TWZORDER1"
    });

    expect(result.status).toBe("DELIVERED");
    // Previously read data.pin / data.serialNumber — neither exists in the real
    // response — so both came back undefined on a successful purchase.
    expect(result.pin).toBe("7y46thfyser");
    expect(result.serialNumber).toBe("534354543453");
  });

  it("sends the documented request shape", async () => {
    const fetcher = jsonFetcher(successPayload);
    const adapter = createTopupWizardAdapter({ apiKey: "token", fetcher });

    await adapter.purchaseEducation!({
      examType: "100",
      phoneNumber: "08030000000",
      reference: "TWZORDER1"
    });

    const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit
    ];
    expect(url).toBe("https://topupwizard.com/api/education");
    expect(JSON.parse(String(init.body))).toEqual({
      serviceID: "100",
      quantity: 1,
      clientReference: "TWZORDER1"
    });
    // Non-standard auth header — not "Authorization: Bearer".
    expect((init.headers as Record<string, string>)["Authorization-Token"]).toBe("token");
  });

  it("reports insufficient funds as FAILED with the provider's message", async () => {
    const adapter = createTopupWizardAdapter({
      apiKey: "token",
      fetcher: jsonFetcher({
        status: "error",
        message: "Insufficient funds",
        data: { status: "failed" }
      })
    });

    const result = await adapter.purchaseEducation!({
      examType: "100",
      phoneNumber: "08030000000",
      reference: "TWZORDER2"
    });

    expect(result.status).toBe("FAILED");
    expect(result.failureReason).toBe("Insufficient funds");
    expect(result.pin).toBeUndefined();
  });

  it("handles the error shape where data is an array, not an object", async () => {
    // "Incorrect Service ID" returns data: [] — reading data.status off an array
    // yields undefined, so the top-level status must decide.
    const adapter = createTopupWizardAdapter({
      apiKey: "token",
      fetcher: jsonFetcher({ status: "error", message: "Incorrect Service ID", data: [] })
    });

    const result = await adapter.purchaseEducation!({
      examType: "999999",
      phoneNumber: "08030000000",
      reference: "TWZORDER3"
    });

    expect(result.status).toBe("FAILED");
    expect(result.failureReason).toBe("Incorrect Service ID");
  });
});

describe("SirpData purchaseEducation", () => {
  it("extracts the first PIN from description.trueResponse", async () => {
    const adapter = createSirpDataAdapter({
      apiKey: "token",
      fetcher: jsonFetcher({
        code: "200",
        description: {
          userEmail: "buyer@example.com",
          recipient: "07035000000",
          narration: "1 NECO PIN(s)",
          trueResponse: { pin1: "857256XXXXXXXXX" },
          amountCharged: "800.00",
          ourRef: "202407171522426934ae834d34d"
        },
        time: "2024-07-17 15:22:42"
      })
    });

    const result = await adapter.purchaseEducation!({
      examType: "neco",
      phoneNumber: "07035000000",
      reference: "ISQORDER1"
    });

    expect(result.status).toBe("DELIVERED");
    expect(result.pin).toBe("857256XXXXXXXXX");
  });

  it("maps the documented exam types to SirpData's examType values", async () => {
    const fetcher = jsonFetcher({ code: "200", description: { trueResponse: { pin1: "x" } } });
    const adapter = createSirpDataAdapter({ apiKey: "token", fetcher });

    await adapter.purchaseEducation!({
      examType: "neco",
      phoneNumber: "07035000000",
      reference: "R1"
    });

    const [, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit
    ];
    expect(JSON.parse(String(init.body)).examType).toBe("neco_pin");
  });
});
