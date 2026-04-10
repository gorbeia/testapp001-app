import { describe, it, expect } from "vitest";
import { slugifyReservationServiceLabel } from "@shared/schema";

describe("slugifyReservationServiceLabel", () => {
  it("slugifies EU labels", () => {
    expect(slugifyReservationServiceLabel("Berogailua")).toBe("berogailua");
    expect(slugifyReservationServiceLabel("  Foo Bar ")).toBe("foo-bar");
  });

  it("strips accents", () => {
    expect(slugifyReservationServiceLabel("Calefacción auxiliar")).toBe("calefaccion-auxiliar");
  });
});
