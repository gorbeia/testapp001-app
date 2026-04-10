import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockInsert, mockMovementExists, mockTx, mockUpdateChain } = vi.hoisted(() => {
  const mockInsert = vi.fn();
  const mockMovementExists = vi.fn();

  function mockUpdateChain() {
    return {
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    };
  }

  const mockTx = {
    update: vi.fn().mockImplementation(() => mockUpdateChain()),
    select: vi.fn(),
    insert: vi.fn(),
  };

  return { mockInsert, mockMovementExists, mockTx, mockUpdateChain };
});

vi.mock("../account-movements", () => ({
  insertAccountMovementRow: (...args: unknown[]) => mockInsert(...args),
  movementExistsForReference: (...args: unknown[]) => mockMovementExists(...args),
}));

vi.mock("../../db", () => ({
  db: {
    transaction: async <T>(fn: (tx: typeof mockTx) => Promise<T>) => fn(mockTx),
  },
}));

import {
  appendSepaCollectionMovementsForCredits,
  maybePostReservationCharge,
  maybePostSubscriptionCharge,
  postCashReservationSettlement,
  postCashSubscriptionSettlement,
  postConsumptionDebit,
  postLedgerRefund,
  postSepaBounceAndResetCredit,
  reverseReservationLedgerOnCancel,
  validateBankTransferAndPostLedger,
} from "./ledger-service";

describe("ledger-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockImplementation(
      (input: {
        societyId: string;
        type: string;
        amount: string;
        description?: string | null;
        createdBy: string | null;
        createdAt?: Date;
      }) =>
        Promise.resolve({
          id: "mov-new",
          societyId: input.societyId,
          type: input.type,
          amount: input.amount,
          description: input.description ?? null,
          createdAt: input.createdAt ?? new Date("2024-01-15T12:00:00.000Z"),
          createdBy: input.createdBy,
        })
    );
    mockMovementExists.mockResolvedValue(false);
    mockTx.update.mockImplementation(() => mockUpdateChain());
    mockTx.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }));
    mockTx.insert.mockImplementation(() => ({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "sl-mock" }]),
      }),
    }));
  });

  it("postLedgerRefund inserts positive refund amount", async () => {
    await postLedgerRefund({
      societyId: "s1",
      userId: "u1",
      amount: 12.34,
      description: "test",
      createdBy: "admin",
    });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "refund",
        amount: "12.34",
        societyId: "s1",
        userId: "u1",
      }),
      mockTx
    );
  });

  it("postConsumptionDebit inserts negative consumption", async () => {
    await postConsumptionDebit({
      societyId: "s1",
      userId: "u1",
      totalPrice: 5,
      description: "Coffee x2",
      referenceId: "item-1",
      createdBy: "u2",
    });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "consumption",
        amount: "-5.00",
        referenceType: "consumption_item",
        referenceId: "item-1",
      }),
      mockTx
    );
  });

  it("validateBankTransferAndPostLedger inserts and updates bank transfer", async () => {
    await validateBankTransferAndPostLedger({
      societyId: "s1",
      bankTransferId: "bt-1",
      userId: "u1",
      amount: 100,
      referenceNote: "note",
      validatedByUserId: "treas",
    });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "bank_transfer",
        amount: "100.00",
        referenceType: "bank_transfer",
        referenceId: "bt-1",
      }),
      mockTx
    );
    expect(mockTx.update).toHaveBeenCalled();
  });

  it("postSepaBounceAndResetCredit throws when bounce exists", async () => {
    mockMovementExists.mockResolvedValueOnce(true);
    await expect(
      postSepaBounceAndResetCredit({
        societyId: "s1",
        credit: {
          id: "c1",
          memberId: "u1",
          totalAmount: "50.00",
          month: "2024-01",
        } as never,
        createdBy: "t",
      })
    ).rejects.toThrow("Bounce already recorded");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("postSepaBounceAndResetCredit posts negative bounce with sepa_bounce reference", async () => {
    const movement = await postSepaBounceAndResetCredit({
      societyId: "s1",
      credit: {
        id: "c1",
        memberId: "u1",
        totalAmount: "50.00",
        month: "2024-01",
      } as never,
      createdBy: "t",
    });
    expect(movement.id).toBe("mov-new");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "sepa_bounce",
        amount: "-50.00",
        referenceType: "sepa_bounce",
        referenceId: "c1",
      }),
      mockTx
    );
  });

  it("appendSepaCollectionMovementsForCredits skips when movement exists", async () => {
    mockMovementExists.mockResolvedValue(true);
    await appendSepaCollectionMovementsForCredits(mockTx as never, {
      societyId: "s1",
      credits: [{ id: "c1", memberId: "u1", totalAmount: "10", month: "2024-01" } as never],
      createdBy: "t",
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("maybePostSubscriptionCharge skips when charge is zero", async () => {
    const r = await maybePostSubscriptionCharge({
      societyId: "s1",
      userId: "u1",
      monthLabel: "2024-01",
      subRef: "u1:2024-01",
      subscriptionCharge: 0,
      createdAt: new Date(),
    });
    expect(r.inserted).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("maybePostSubscriptionCharge skips insert when movement exists", async () => {
    mockMovementExists.mockResolvedValueOnce(true);
    const r = await maybePostSubscriptionCharge({
      societyId: "s1",
      userId: "u1",
      monthLabel: "2024-01",
      subRef: "u1:2024-01",
      subscriptionCharge: 5,
      createdAt: new Date(),
    });
    expect(r.inserted).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("maybePostSubscriptionCharge inserts subscription debit when missing", async () => {
    const d = new Date("2024-01-31T23:59:59.999Z");
    const r = await maybePostSubscriptionCharge({
      societyId: "s1",
      userId: "u1",
      monthLabel: "2024-01",
      subRef: "u1:2024-01",
      subscriptionCharge: 5,
      createdAt: d,
    });
    expect(r.inserted).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "subscription",
        amount: "-5.00",
        referenceType: "subscription",
        createdAt: d,
        createdBy: null,
      }),
      mockTx
    );
  });

  it("maybePostReservationCharge skips when exists", async () => {
    mockMovementExists.mockResolvedValueOnce(true);
    const r = await maybePostReservationCharge({
      societyId: "s1",
      userId: "u1",
      reservationId: "r1",
      amount: 20,
      reservationName: "Room",
      createdAt: new Date(),
    });
    expect(r.inserted).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("postCashReservationSettlement posts reservation leg when missing", async () => {
    mockMovementExists.mockResolvedValueOnce(false);
    await postCashReservationSettlement({
      societyId: "s1",
      userId: "u1",
      reservationId: "r1",
      totalAmount: 25,
      reservationName: "Hall",
      createdBy: "u1",
    });
    expect(mockInsert).toHaveBeenCalledTimes(2);
    expect(mockInsert.mock.calls[0][0]).toMatchObject({
      type: "reservation",
      referenceType: "reservation",
      amount: "-25.00",
    });
    expect(mockInsert.mock.calls[1][0]).toMatchObject({
      type: "cash_payment",
      amount: "25.00",
    });
  });

  it("postCashReservationSettlement skips reservation debit when charge exists", async () => {
    mockMovementExists.mockResolvedValueOnce(true);
    await postCashReservationSettlement({
      societyId: "s1",
      userId: "u1",
      reservationId: "r1",
      totalAmount: 25,
      reservationName: "Hall",
      createdBy: "u1",
    });
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert.mock.calls[0][0]).toMatchObject({ type: "cash_payment" });
  });

  it("postCashSubscriptionSettlement returns skipped when already settled", async () => {
    mockMovementExists.mockResolvedValueOnce(true);
    const r = await postCashSubscriptionSettlement({
      societyId: "s1",
      userId: "u1",
      month: "2024-01",
      subRef: "u1:2024-01",
      amount: 10,
      createdBy: "u1",
    });
    expect(r).toEqual({ skipped: true });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("reverseReservationLedgerOnCancel posts cancel adjustment when reservation charge exists", async () => {
    mockMovementExists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);
    await reverseReservationLedgerOnCancel({
      societyId: "s1",
      pre: {
        id: "r1",
        userId: "u1",
        name: "Hall",
        totalAmount: "30",
      } as never,
      cancelledByUserId: "u2",
      cancelDescriptionPrefix: "Reservation cancelled:",
    });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "adjustment",
        referenceType: "reservation_cancel",
        amount: "30.00",
      }),
      mockTx
    );
  });
});
