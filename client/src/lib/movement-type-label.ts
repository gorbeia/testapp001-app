import type { TranslationKey } from "@/lib/i18n";

const TYPE_TO_I18N = {
  consumption: "movementTypeConsumption",
  reservation: "movementTypeReservation",
  subscription: "movementTypeSubscription",
  sepa_collection: "movementTypeSepa_collection",
  sepa_bounce: "movementTypeSepa_bounce",
  bank_transfer: "movementTypeBank_transfer",
  refund: "movementTypeRefund",
  adjustment: "movementTypeAdjustment",
  cash_payment: "movementTypeCash_payment",
} as const satisfies Record<string, TranslationKey>;

export function movementTypeLabelKey(type: string): TranslationKey {
  if (type in TYPE_TO_I18N) {
    return TYPE_TO_I18N[type as keyof typeof TYPE_TO_I18N];
  }
  return "movementTypeConsumption";
}
