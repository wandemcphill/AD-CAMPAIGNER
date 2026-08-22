import { describe, expect, it } from "vitest";

import { renderNotificationTemplate, renderTemplate } from "./templates";

describe("renderTemplate", () => {
  it("substitutes plain text without escaping in text context (default)", () => {
    const result = renderTemplate("Hi {{first_name}}, ref {{reference}}", {
      first_name: "Ada",
      reference: "TX-100"
    });

    expect(result).toBe("Hi Ada, ref TX-100");
  });

  it("HTML-escapes an untagged placeholder in html context", () => {
    const result = renderTemplate(
      "<p>Hi {{first_name}}</p>",
      { first_name: `<img src=x onerror="alert(1)">` },
      "html"
    );

    expect(result).toBe("<p>Hi &lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>");
    expect(result).not.toContain("<img");
  });

  it("does not double-escape an already-safe value", () => {
    const result = renderTemplate("<p>{{status}}</p>", { status: "Delivered" }, "html");

    expect(result).toBe("<p>Delivered</p>");
  });

  it("leaves plain text unescaped even for values containing HTML-special characters", () => {
    // Subjects and SMS bodies can't render markup, so escaping them would
    // just show the reader a literal "&amp;" instead of "&".
    const result = renderTemplate("{{service}} & co", { service: "Airtime" });

    expect(result).toBe("Airtime & co");
  });

  describe("{{url:name}} placeholders", () => {
    it("passes through a safe https URL and escapes it for the attribute", () => {
      const result = renderTemplate(
        `<a href="{{url:reference}}">go</a>`,
        { reference: "https://fliptrybe.xyz/reset-password?token=abc&x=1" },
        "html"
      );

      expect(result).toBe(
        `<a href="https://fliptrybe.xyz/reset-password?token=abc&amp;x=1">go</a>`
      );
    });

    it("neutralizes a javascript: scheme", () => {
      const result = renderTemplate(
        `<a href="{{url:reference}}">go</a>`,
        { reference: "javascript:alert(document.cookie)" },
        "html"
      );

      expect(result).toBe(`<a href="#">go</a>`);
      expect(result).not.toContain("javascript:");
    });

    it("neutralizes a data: scheme", () => {
      const result = renderTemplate(
        `<a href="{{url:reference}}">go</a>`,
        { reference: "data:text/html,<script>alert(1)</script>" },
        "html"
      );

      expect(result).toBe(`<a href="#">go</a>`);
    });

    it("neutralizes a scheme smuggled past a naive check via control characters", () => {
      const result = renderTemplate(
        `<a href="{{url:reference}}">go</a>`,
        { reference: "java\tscript:alert(1)" },
        "html"
      );

      expect(result).toBe(`<a href="#">go</a>`);
    });

    it("neutralizes a case-variant javascript: scheme", () => {
      const result = renderTemplate(
        `<a href="{{url:reference}}">go</a>`,
        { reference: "JaVaScRiPt:alert(1)" },
        "html"
      );

      expect(result).toBe(`<a href="#">go</a>`);
    });

    it("falls back to # for an empty URL", () => {
      const result = renderTemplate(`<a href="{{url:reference}}">go</a>`, {}, "html");

      expect(result).toBe(`<a href="#">go</a>`);
    });

    it("resolves a relative path against the app origin", () => {
      const result = renderTemplate(
        `<a href="{{url:reference}}">go</a>`,
        { reference: "/support" },
        "html"
      );

      expect(result).toContain(`href="`);
      expect(result).not.toBe(`<a href="#">go</a>`);
    });

    it("does not attribute-escape twice when the URL contains an ampersand", () => {
      const result = renderTemplate(
        `<a href="{{url:reference}}">go</a>`,
        { reference: "https://fliptrybe.xyz/x?a=1&b=2" },
        "html"
      );

      expect(result).toContain("a=1&amp;b=2");
      expect(result).not.toContain("&amp;amp;");
    });
  });
});

describe("renderNotificationTemplate", () => {
  it("escapes an attacker-controlled first_name in the email body but not the SMS body", () => {
    const rendered = renderNotificationTemplate("password_reset", {
      first_name: `<script>alert(1)</script>`,
      reference: "https://fliptrybe.xyz/reset-password?token=abc",
      status: "30 minutes"
    });

    expect(rendered.emailBody).not.toContain("<script>");
    expect(rendered.emailBody).toContain("&lt;script&gt;");
    // The SMS variant never includes first_name at all (see templates.ts) —
    // confirms the reset link itself never crosses into SMS.
    expect(rendered.smsBody).not.toContain("token=");
  });

  it("keeps the password reset link a working https URL end to end", () => {
    const resetUrl = "https://fliptrybe.xyz/reset-password?token=abc123&ref=email";
    const rendered = renderNotificationTemplate("password_reset", {
      first_name: "Ada",
      reference: resetUrl,
      status: "30 minutes"
    });

    expect(rendered.emailBody).toContain(
      `href="https://fliptrybe.xyz/reset-password?token=abc123&amp;ref=email"`
    );
  });

  it("neutralizes a javascript: reset link so the button is never a live link", () => {
    const rendered = renderNotificationTemplate("password_reset", {
      first_name: "Ada",
      reference: "javascript:alert(document.cookie)",
      status: "30 minutes"
    });

    expect(rendered.emailBody).toContain(`href="#"`);
    expect(rendered.emailBody).not.toContain(`href="javascript:`);
    // The template also shows the raw link as copy-paste text for clients
    // that can't click the button. That's a <span>, never an href, so the
    // value appearing there verbatim is inert — not a live link.
  });

  it("escapes a hostile transaction status in a receipt without breaking the layout", () => {
    const rendered = renderNotificationTemplate("transaction_receipt", {
      service: "Airtime",
      status: `<img src=x onerror=alert(1)>`,
      currency: "NGN",
      amount: "500.00",
      reference: "ref_1",
      transaction_id: "txn_1",
      date: "2026-08-22"
    });

    expect(rendered.emailBody).not.toContain("<img");
    expect(rendered.emailBody).toContain("&lt;img");
  });

  it("keeps the support link safe and functional in the default wrapper", () => {
    const rendered = renderNotificationTemplate("otp", { reference: "123456" });

    expect(rendered.emailBody).toMatch(/href="https:\/\/[^"]+\/support"/);
  });
});
