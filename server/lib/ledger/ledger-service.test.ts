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

  function mockSelectChain(results: any[] = []) {
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(results),
        }),
      }),
    };
  }

  const mockTx = {
    update: vi.fn().mockImplementation(() => mockUpdateChain()),
    select: vi.fn().mockImplementation(() => mockSelectChain()),
    insert: vi.fn(),
  };

  return { mockInsert, mockMovementExists, mockTx, mockUpdateChain };
});

vi.mock("../account-movements", () => ({
  insertAccountMovementRow: (...args: unknown[]) => mockInsert(...args),
  movementExistsForReference: (...args: unknown[]) => mockMovementExists(...args),
}));

vi.mock("../society-ledger", () => ({
  mirrorAccountMovementToSocietyLedger: vi.fn().mockResolvedValue(undefined),
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
  postLedgerCorrection,
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
        referenceId?: string | null;
        referenceType?: string | null;
        isCorrection?: boolean;
        correctionReason?: string | null;
      }) =>
        Promise.resolve({
          id: "mov-new",
          societyId: input.societyId,
          type: input.type,
          amount: input.amount,
          description: input.description ?? null,
          referenceId: input.referenceId ?? null,
          referenceType: input.referenceType ?? null,
          isCorrection: input.isCorrection ?? false,
          correctionReason: input.correctionReason ?? null,
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

  describe("postLedgerCorrection", () => {
    // For postLedgerCorrection, we need a more sophisticated mock
    // because it uses tx.select().from().where(and(...))
    // Let's create a query builder mock that actually returns results

    const createQueryBuilder = (results: any[]) => {
      const builder: any = {
        results,
      };
      builder.select = vi.fn().mockReturnValue(builder);
      builder.from = vi.fn().mockReturnValue(builder);
      builder.where = vi.fn().mockReturnValue(builder);
      // Make it thenable
      builder.then = vi.fn().mockImplementation((onFulfilled: (value: any) => any) => {
        return Promise.resolve(builder.results).then(onFulfilled);
      });
      return builder;
    };

    beforeEach(() => {
      vi.clearAllMocks();
      // Reset to default behavior
      mockInsert.mockImplementation((input: any) =>
        Promise.resolve({
          id: "mov-new",
          societyId: input.societyId,
          type: input.type,
          amount: input.amount,
          description: input.description ?? null,
          referenceId: input.referenceId ?? null,
          referenceType: input.referenceType ?? null,
          isCorrection: input.isCorrection ?? false,
          correctionReason: input.correctionReason ?? null,
          createdAt: input.createdAt ?? new Date("2024-01-15T12:00:00.000Z"),
          createdBy: input.createdBy,
        })
      );
      mockTx.select.mockImplementation(() => createQueryBuilder([]));
      mockTx.update.mockImplementation(() => mockUpdateChain());
    });

    it("creates correction movement and links to original", async () => {
      mockTx.select.mockReturnValue(
        createQueryBuilder([
          {
            id: "orig-123",
            societyId: "s1",
            userId: "u1",
            type: "consumption",
            amount: "-50.00",
            isCorrection: false,
            correctedById: null,
          },
        ])
      );
      mockTx.update.mockReturnValue(mockUpdateChain());

      const result = await postLedgerCorrection({
        societyId: "s1",
        userId: "u1",
        originalMovementId: "orig-123",
        amount: 25.0,
        reason: "Overcharged",
        createdBy: "admin",
      });

      expect(result.type).toBe("correction");
      expect(result.amount).toBe("25.00");
      expect(result.isCorrection).toBe(true);
      expect(result.referenceId).toBe("orig-123");
      expect(result.referenceType).toBe("movement_correction");
      expect(result.correctionReason).toBe("Overcharged");

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "correction",
          amount: "25.00",
          isCorrection: true,
          referenceId: "orig-123",
          referenceType: "movement_correction",
          correctionReason: "Overcharged",
        }),
        mockTx
      );

      expect(mockTx.update).toHaveBeenCalled();
    });

    it("throws error when original movement not found", async () => {
      mockTx.select.mockReturnValue(createQueryBuilder([]));

      await expect(
        postLedgerCorrection({
          societyId: "s1",
          userId: "u1",
          originalMovementId: "not-found",
          amount: 10.0,
          reason: "Test",
          createdBy: "admin",
        })
      ).rejects.toThrow("Original movement not found or not in your society");
    });

    it("throws error when correcting a correction", async () => {
      mockTx.select.mockReturnValue(
        createQueryBuilder([
          {
            id: "corr-123",
            societyId: "s1",
            userId: "u1",
            type: "correction",
            isCorrection: true,
            correctedById: null,
          },
        ])
      );

      await expect(
        postLedgerCorrection({
          societyId: "s1",
          userId: "u1",
          originalMovementId: "corr-123",
          amount: 10.0,
          reason: "Test",
          createdBy: "admin",
        })
      ).rejects.toThrow("Cannot correct a correction");
    });

    it("throws error when original already corrected", async () => {
      mockTx.select.mockReturnValue(
        createQueryBuilder([
          {
            id: "orig-123",
            societyId: "s1",
            userId: "u1",
            isCorrection: false,
            correctedById: "existing-correction",
          },
        ])
      );

      await expect(
        postLedgerCorrection({
          societyId: "s1",
          userId: "u1",
          originalMovementId: "orig-123",
          amount: 10.0,
          reason: "Test",
          createdBy: "admin",
        })
      ).rejects.toThrow("This movement has already been corrected");
    });

    it("uses description from params if provided", async () => {
      mockTx.select.mockReturnValue(
        createQueryBuilder([
          {
            id: "orig-456",
            societyId: "s1",
            userId: "u1",
            isCorrection: false,
            correctedById: null,
          },
        ])
      );
      mockTx.update.mockReturnValue(mockUpdateChain());

      await postLedgerCorrection({
        societyId: "s1",
        userId: "u1",
        originalMovementId: "orig-456",
        amount: 10.0,
        reason: "Test reason",
        description: "Custom description",
        createdBy: "admin",
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Custom description",
        }),
        mockTx
      );
    });

    it("uses default description when not provided", async () => {
      mockTx.select.mockReturnValue(
        createQueryBuilder([
          {
            id: "orig-789",
            societyId: "s1",
            userId: "u1",
            isCorrection: false,
            correctedById: null,
          },
        ])
      );
      mockTx.update.mockReturnValue(mockUpdateChain());

      await postLedgerCorrection({
        societyId: "s1",
        userId: "u1",
        originalMovementId: "orig-789",
        amount: 10.0,
        reason: "Test reason",
        createdBy: "admin",
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Correction for movement orig-789",
        }),
        mockTx
      );
    });
  });
});
