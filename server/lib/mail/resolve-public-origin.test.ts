import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolvePublicOriginForMail } from "./resolve-public-origin";

const KEYS = ["APP_PUBLIC_ORIGIN", "TENANT_APEX_DOMAIN", "NODE_ENV", "PORT"] as const;

describe("resolvePublicOriginForMail", () => {
  const original: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const k of KEYS) {
      original[k] = process.env[k];
    }
  });

  afterEach(() => {
    for (const k of KEYS) {
      const v = original[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("strips trailing slash from APP_PUBLIC_ORIGIN", () => {
    process.env.APP_PUBLIC_ORIGIN = "https://app.example.com/";
    process.env.NODE_ENV = "production";
    delete process.env.TENANT_APEX_DOMAIN;
    expect(resolvePublicOriginForMail()).toBe("https://app.example.com");
  });

  it("in production, uses https://TENANT_APEX_DOMAIN when APP_PUBLIC_ORIGIN is unset", () => {
    delete process.env.APP_PUBLIC_ORIGIN;
    process.env.TENANT_APEX_DOMAIN = "elkartea.eus";
    process.env.NODE_ENV = "production";
    expect(resolvePublicOriginForMail()).toBe("https://elkartea.eus");
  });

  it("in development, ignores TENANT_APEX_DOMAIN and uses localhost", () => {
    delete process.env.APP_PUBLIC_ORIGIN;
    process.env.TENANT_APEX_DOMAIN = "elkartea.eus";
    process.env.NODE_ENV = "development";
    process.env.PORT = "5000";
    expect(resolvePublicOriginForMail()).toBe("http://localhost:5000");
  });

  it("defaults PORT to 5000 when unset in dev", () => {
    delete process.env.APP_PUBLIC_ORIGIN;
    delete process.env.TENANT_APEX_DOMAIN;
    process.env.NODE_ENV = "development";
    delete process.env.PORT;
    expect(resolvePublicOriginForMail()).toBe("http://localhost:5000");
  });
});
