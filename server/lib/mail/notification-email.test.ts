import { describe, expect, it } from "vitest";
import { resolveNotificationEmailContent } from "./notification-email";

describe("resolveNotificationEmailContent", () => {
  it("prefers user language when present in messages", () => {
    const r = resolveNotificationEmailContent({
      notification: { title: "EU", message: "eu body", defaultLanguage: "eu" },
      messages: [
        { language: "eu", title: "EU", message: "eu body" },
        { language: "es", title: "ES", message: "es body" },
      ],
      preferredLanguage: "es",
    });
    expect(r.title).toBe("ES");
    expect(r.text).toBe("es body");
  });

  it("falls back to defaultLanguage then eu", () => {
    const r = resolveNotificationEmailContent({
      notification: { title: "T", message: "M", defaultLanguage: "eu" },
      messages: [{ language: "eu", title: "EU t", message: "EU m" }],
      preferredLanguage: "en",
    });
    expect(r.title).toBe("EU t");
  });
});
