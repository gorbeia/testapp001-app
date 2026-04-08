import { describe, expect, it } from "vitest";
import { parseHostForTenant, RESERVED_SOCIETY_SUBDOMAIN_LABELS, societySubdomainFieldSchema } from "./tenant-host";

describe("parseHostForTenant", () => {
  it("returns apex for exact apex host", () => {
    expect(parseHostForTenant("example.com", "example.com")).toEqual({ kind: "apex" });
  });

  it("returns apex for www", () => {
    expect(parseHostForTenant("www.example.com", "example.com")).toEqual({ kind: "apex" });
  });

  it("returns tenant for single-level subdomain", () => {
    expect(parseHostForTenant("txokoa.example.com", "example.com")).toEqual({
      kind: "tenant",
      subdomain: "txokoa",
    });
  });

  it("strips port from host", () => {
    expect(parseHostForTenant("txokoa.example.com:443", "example.com")).toEqual({
      kind: "tenant",
      subdomain: "txokoa",
    });
  });

  it("returns apex for unrelated host", () => {
    expect(parseHostForTenant("other.org", "example.com")).toEqual({ kind: "apex" });
  });

  it("returns apex for nested subdomain (not supported)", () => {
    expect(parseHostForTenant("a.b.example.com", "example.com")).toEqual({ kind: "apex" });
  });
});

describe("societySubdomainFieldSchema", () => {
  it("accepts valid labels", () => {
    expect(societySubdomainFieldSchema.safeParse("Txokoa-1").success).toBe(true);
  });

  it("rejects reserved labels", () => {
    for (const r of RESERVED_SOCIETY_SUBDOMAIN_LABELS) {
      expect(societySubdomainFieldSchema.safeParse(r).success).toBe(false);
    }
  });
});
