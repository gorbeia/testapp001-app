export type Language = "eu" | "es" | "en";

export const translations = {
  eu: {
    // Email notifications (server-generated)
    reservationCancelledNotification:
      'Zure "{reservationName}" erreserba bertan behera utzi da. Data: {date}.',
    reservationConfirmedNotification:
      'Zure "{reservationName}" erreserba baieztatu da. Data: {date}.',
    reservationCreatedNotification:
      'Zure "{reservationName}" erreserba ondo egin da. Data: {date}.',
    emailSubject: {
      reservationCancelled: "Erreserba bertan behera utzita",
      reservationConfirmed: "Erreserba baieztatua",
      reservationCreated: "Erreserba sortua",
    },
    financialBankTransferValidatedTitle: "Transferentzia balioztatua",
    financialBankTransferValidatedMessage:
      "Zure {amount} € transferentzia balioztatu da eta zure kontuan erregistratu da.",
    financialBankTransferRejectedTitle: "Transferentzia baztertua",
    financialBankTransferRejectedMessage:
      "Zure transferentzia baztertu da. Arrazoi bat: {reason}",
    financialRefundIssuedTitle: "Itzulketa",
    financialRefundIssuedMessage: "{amount} € itzulketa erregistratu da zure kontuan.",
    financialSepaBounceTitle: "SEPA ordainketa huts egin du",
    financialSepaBounceMessage:
      "Zure {month} hilabeteko SEPA zordunketak huts egin du. Zorra berriro zain dago.",
    financialReservationChargeTitle: "Erreserba kargua",
    financialReservationChargeMessage:
      '"{name}" erreserbaren kargua: {amount} €.',
    financialSubscriptionChargeTitle: "Harpidetza kargua",
    financialSubscriptionChargeMessage: "{month} hilabeteko harpidetza: {amount} €.",
  },

  es: {
    // Email notifications (server-generated)
    reservationCancelledNotification:
      'Tu reserva "{reservationName}" ha sido cancelada. Fecha: {date}.',
    reservationConfirmedNotification:
      'Tu reserva "{reservationName}" ha sido confirmada. Fecha: {date}.',
    reservationCreatedNotification:
      'Tu reserva "{reservationName}" se ha realizado correctamente. Fecha: {date}.',
    emailSubject: {
      reservationCancelled: "Reserva cancelada",
      reservationConfirmed: "Reserva confirmada",
      reservationCreated: "Reserva creada",
    },
    financialBankTransferValidatedTitle: "Transferencia validada",
    financialBankTransferValidatedMessage:
      "Tu transferencia de {amount} € ha sido validada y registrada en tu cuenta.",
    financialBankTransferRejectedTitle: "Transferencia rechazada",
    financialBankTransferRejectedMessage:
      "Tu transferencia ha sido rechazada. Motivo: {reason}",
    financialRefundIssuedTitle: "Reembolso",
    financialRefundIssuedMessage: "Se ha registrado un reembolso de {amount} € en tu cuenta.",
    financialSepaBounceTitle: "Fallo del adeudo SEPA",
    financialSepaBounceMessage:
      "El adeudo SEPA de {month} ha fallado. La deuda vuelve a estar pendiente.",
    financialReservationChargeTitle: "Cargo por reserva",
    financialReservationChargeMessage: 'Cargo por la reserva "{name}": {amount} €.',
    financialSubscriptionChargeTitle: "Cuota de suscripción",
    financialSubscriptionChargeMessage: "Cuota de suscripción {month}: {amount} €.",
  },

  en: {
    // Email notifications (server-generated)
    reservationCancelledNotification:
      'Your "{reservationName}" reservation has been cancelled. Date: {date}.',
    reservationConfirmedNotification:
      'Your "{reservationName}" reservation has been confirmed. Date: {date}.',
    reservationCreatedNotification:
      'Your "{reservationName}" reservation has been successfully made. Date: {date}.',
    emailSubject: {
      reservationCancelled: "Reservation Cancelled",
      reservationConfirmed: "Reservation Confirmed",
      reservationCreated: "Reservation Created",
    },
    financialBankTransferValidatedTitle: "Transfer validated",
    financialBankTransferValidatedMessage:
      "Your transfer of {amount} € has been validated and recorded on your account.",
    financialBankTransferRejectedTitle: "Transfer rejected",
    financialBankTransferRejectedMessage: "Your transfer was rejected. Reason: {reason}",
    financialRefundIssuedTitle: "Refund",
    financialRefundIssuedMessage: "A refund of {amount} € has been recorded on your account.",
    financialSepaBounceTitle: "SEPA direct debit failed",
    financialSepaBounceMessage:
      "Your SEPA collection for {month} failed. The debt is pending again.",
    financialReservationChargeTitle: "Reservation charge",
    financialReservationChargeMessage: 'Charge for reservation "{name}": {amount} €.',
    financialSubscriptionChargeTitle: "Subscription charge",
    financialSubscriptionChargeMessage: "Subscription charge for {month}: {amount} €.",
  },
};

export type TranslationKey = keyof typeof translations.eu;
