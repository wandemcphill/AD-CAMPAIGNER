import { describe, expect, it } from "vitest";

import { normalizeNigerianMsisdn } from "./msisdn";

describe("normalizeNigerianMsisdn", () => {
  it("converts local trunk format (leading 0) to international", () => {
    // The exact numbers from the production bug report: both were rejected
    // by buyAirtime/buyData because the old validation required the first
    // digit to be 1-9, which a leading 0 can never satisfy.
    expect(normalizeNigerianMsisdn("07014442268")).toBe("2347014442268");
    expect(normalizeNigerianMsisdn("07026690253")).toBe("2347026690253");
  });

  it("leaves an already-international number unchanged", () => {
    expect(normalizeNigerianMsisdn("2347014442268")).toBe("2347014442268");
  });

  it("strips a leading + from an international number", () => {
    expect(normalizeNigerianMsisdn("+2347014442268")).toBe("2347014442268");
  });

  it("prepends the country code to a bare 10-digit subscriber number", () => {
    expect(normalizeNigerianMsisdn("7014442268")).toBe("2347014442268");
  });

  it("strips spaces and dashes before matching", () => {
    expect(normalizeNigerianMsisdn("0701 444 2268")).toBe("2347014442268");
    expect(normalizeNigerianMsisdn("0701-444-2268")).toBe("2347014442268");
    expect(normalizeNigerianMsisdn("+234 701 444 2268")).toBe("2347014442268");
  });

  it("returns unrecognized shapes unchanged so validation still rejects them", () => {
    // Too short to be a real number, and not one of the recognized shapes --
    // this function does not try to guess; it defers to the caller's own
    // validation, which is what actually protects against malformed input.
    expect(normalizeNigerianMsisdn("12345")).toBe("12345");
    // Wrong country code entirely -- not this function's job to reject it,
    // just not to falsely "fix" it into something it isn't.
    expect(normalizeNigerianMsisdn("+15551234567")).toBe("15551234567");
    // Empty input stays empty.
    expect(normalizeNigerianMsisdn("")).toBe("");
  });
});
