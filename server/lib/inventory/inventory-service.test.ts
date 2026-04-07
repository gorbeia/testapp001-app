import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyStockDelta,
  InventoryServiceError,
  isStockTracked,
  normalizeStockMode,
  shouldAutoDecrement,
} from "./inventory-service";
import type { AppDatabase } from "../../db";
import type { Product } from "@shared/schema";

function minimalProduct(overrides: Partial<Product> = {}): Product {
  const now = new Date();
  return {
    id: "prod-1",
    name: "Test Product",
    description: null,
    categoryId: "cat-1",
    price: "1.00",
    stock: "10",
    unit: "unit",
    stockMode: "auto",
    minStock: "2",
    lowStockNotified: false,
    supplier: null,
    isActive: true,
    societyId: "soc-1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createMockDb(productRow: Product | null) {
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const insertReturning = vi.fn();

  const mockDb = {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(productRow ? [productRow] : []),
        }),
      }),
    })),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: updateWhere,
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: insertReturning,
      }),
    }),
  } as unknown as AppDatabase;

  return {
    mockDb,
    insertReturning,
    updateWhere,
  };
}

describe("inventory-service predicates", () => {
  it("normalizeStockMode defaults unknown to auto", () => {
    expect(normalizeStockMode(undefined)).toBe("auto");
    expect(normalizeStockMode(null)).toBe("auto");
    expect(normalizeStockMode("")).toBe("auto");
    expect(normalizeStockMode("garbage")).toBe("auto");
  });

  it("normalizeStockMode preserves manual and none", () => {
    expect(normalizeStockMode("manual")).toBe("manual");
    expect(normalizeStockMode("none")).toBe("none");
    expect(normalizeStockMode("auto")).toBe("auto");
  });

  it("isStockTracked is false only for none", () => {
    expect(isStockTracked({ stockMode: "none" })).toBe(false);
    expect(isStockTracked({ stockMode: "auto" })).toBe(true);
    expect(isStockTracked({ stockMode: "manual" })).toBe(true);
    expect(isStockTracked({})).toBe(true);
  });

  it("shouldAutoDecrement is true only for auto", () => {
    expect(shouldAutoDecrement({ stockMode: "auto" })).toBe(true);
    expect(shouldAutoDecrement({})).toBe(true);
    expect(shouldAutoDecrement({ stockMode: "manual" })).toBe(false);
    expect(shouldAutoDecrement({ stockMode: "none" })).toBe(false);
  });
});

describe("applyStockDelta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies negative delta and inserts movement", async () => {
    const product = minimalProduct({ stock: "10" });
    const { mockDb, insertReturning } = createMockDb(product);
    insertReturning.mockResolvedValue([
      {
        id: "mov-1",
        productId: "prod-1",
        societyId: "soc-1",
        type: "consumption",
        quantity: -3,
        reason: "Bar consumption",
        referenceId: "cons-1",
        previousStock: "10",
        newStock: "7",
        createdBy: "u1",
        createdAt: new Date(),
      },
    ]);

    const movement = await applyStockDelta(mockDb, {
      productId: "prod-1",
      societyId: "soc-1",
      delta: -3,
      type: "consumption",
      reason: "Bar consumption",
      referenceId: "cons-1",
      createdBy: "u1",
    });

    expect(movement.quantity).toBe(-3);
    expect(movement.newStock).toBe("7");
    expect(mockDb.insert).toHaveBeenCalled();
    const valuesCall = vi.mocked(mockDb.insert).mock.results[0]?.value.values;
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: -3,
        previousStock: "10",
        newStock: "7",
        type: "consumption",
      })
    );
  });

  it("applies positive purchase delta", async () => {
    const product = minimalProduct({ stock: "5" });
    const { mockDb, insertReturning } = createMockDb(product);
    insertReturning.mockResolvedValue([
      {
        id: "mov-2",
        productId: "prod-1",
        societyId: "soc-1",
        type: "purchase",
        quantity: 12,
        reason: "Hornidura",
        referenceId: "rec-1",
        previousStock: "5",
        newStock: "17",
        createdBy: "u1",
        createdAt: new Date(),
      },
    ]);

    await applyStockDelta(mockDb, {
      productId: "prod-1",
      societyId: "soc-1",
      delta: 12,
      type: "purchase",
      reason: "Hornidura",
      referenceId: "rec-1",
      createdBy: "u1",
    });

    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("uses newStockOverride when provided", async () => {
    const product = minimalProduct({ stock: "3" });
    const { mockDb, insertReturning } = createMockDb(product);
    insertReturning.mockResolvedValue([
      {
        id: "mov-3",
        productId: "prod-1",
        societyId: "soc-1",
        type: "adjustment",
        quantity: 2,
        reason: "take",
        referenceId: "take-1",
        previousStock: "3",
        newStock: "12",
        createdBy: "u1",
        createdAt: new Date(),
      },
    ]);

    await applyStockDelta(mockDb, {
      productId: "prod-1",
      societyId: "soc-1",
      delta: 2,
      type: "adjustment",
      reason: "take",
      referenceId: "take-1",
      createdBy: "u1",
      newStockOverride: "12",
    });

    const valuesCall = vi.mocked(mockDb.insert).mock.results[0]?.value.values;
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({
        newStock: "12",
        previousStock: "3",
      })
    );
  });

  it("throws PRODUCT_NOT_FOUND when product missing", async () => {
    const { mockDb, insertReturning } = createMockDb(null);
    insertReturning.mockResolvedValue([]);

    await expect(
      applyStockDelta(mockDb, {
        productId: "prod-1",
        societyId: "soc-1",
        delta: -1,
        type: "consumption",
        reason: "x",
        referenceId: null,
        createdBy: "u1",
      })
    ).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });

    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("throws STOCK_MODE_NONE for stock_mode none", async () => {
    const product = minimalProduct({ stockMode: "none", stock: "0" });
    const { mockDb, insertReturning } = createMockDb(product);
    insertReturning.mockResolvedValue([]);

    await expect(
      applyStockDelta(mockDb, {
        productId: "prod-1",
        societyId: "soc-1",
        delta: 1,
        type: "purchase",
        reason: "x",
        referenceId: null,
        createdBy: "u1",
      })
    ).rejects.toMatchObject({ code: "STOCK_MODE_NONE" });

    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("throws INVALID_STOCK when stock is not a number", async () => {
    const product = minimalProduct({ stock: "not-a-number" });
    const { mockDb, insertReturning } = createMockDb(product);
    insertReturning.mockResolvedValue([]);

    await expect(
      applyStockDelta(mockDb, {
        productId: "prod-1",
        societyId: "soc-1",
        delta: 1,
        type: "adjustment",
        reason: "x",
        referenceId: null,
        createdBy: "u1",
      })
    ).rejects.toMatchObject({ code: "INVALID_STOCK" });
  });

  it("InventoryServiceError has correct name", () => {
    const e = new InventoryServiceError("msg", "PRODUCT_NOT_FOUND");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("InventoryServiceError");
    expect(e.code).toBe("PRODUCT_NOT_FOUND");
  });
});
