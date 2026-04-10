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
    financialBankTransferValidatedTitle: "Aurreordainketa balioztatua",
    financialBankTransferValidatedMessage:
      "Zure {amount} € aurreordainketa balioztatu da eta zure kontuan erregistratu da.",
    financialBankTransferRejectedTitle: "Aurreordainketa baztertua",
    financialBankTransferRejectedMessage:
      "Zure aurreordainketa proposamena baztertu da. Arrazoi bat: {reason}",
    financialRefundIssuedTitle: "Itzulketa",
    financialRefundIssuedMessage: "{amount} € itzulketa erregistratu da zure kontuan.",
    financialSepaBounceTitle: "Helbideratze kobrantzak huts egin du",
    financialSepaBounceMessage:
      "Zure {month} hilabeteko bankuko helbideratze kobrantzak huts egin du. Zorra berriro zain dago.",
    financialReservationChargeTitle: "Erreserba kargua",
    financialReservationChargeMessage: '"{name}" erreserbaren kargua: {amount} €.',
    financialPrepaymentFloorBreachedTitle: "Saldoa baimendutako mugatik haratago",
    financialPrepaymentFloorBreachedMessage:
      "Zure kontu-saldoa ({balance} €) elkarteak ezarritako gutxienekoa ({floor} €) baino txikiagoa da. Egiten aurreordainketa bat.",
    financialSubscriptionChargeTitle: "Harpidetza kargua",
    financialSubscriptionChargeMessage: "{month} hilabeteko harpidetza: {amount} €.",
    stockLowAlertTitle: "Stock baxua",
    stockLowAlertMessage: "{productName}: {newStock} {unit} geratzen dira (minimoa: {minStock}).",
    reservationBlockedBySocietyEvent:
      'Ezin da erreserba egin epe horretan: "{title}" gertaerak blokeatzen du.',
    reservationBlockedKitchenByEvent:
      'Ezin da sukaldea erabili erreserba honetan: "{title}" gertaerak blokeatzen du.',
    reservationBlockedTableByEvent:
      'Ezin da mahaia erreserbatu: "{title}" gertaerak mahaia blokeatzen du.',
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
    financialBankTransferValidatedTitle: "Prepago validado",
    financialBankTransferValidatedMessage:
      "Tu prepago de {amount} € ha sido validado y registrado en tu cuenta.",
    financialBankTransferRejectedTitle: "Prepago rechazado",
    financialBankTransferRejectedMessage:
      "Tu propuesta de prepago ha sido rechazada. Motivo: {reason}",
    financialRefundIssuedTitle: "Reembolso",
    financialRefundIssuedMessage: "Se ha registrado un reembolso de {amount} € en tu cuenta.",
    financialSepaBounceTitle: "Fallo del adeudo domiciliado",
    financialSepaBounceMessage:
      "El adeudo domiciliado de {month} ha fallado. La deuda vuelve a estar pendiente.",
    financialReservationChargeTitle: "Cargo por reserva",
    financialReservationChargeMessage: 'Cargo por la reserva "{name}": {amount} €.',
    financialPrepaymentFloorBreachedTitle: "Saldo por debajo del mínimo permitido",
    financialPrepaymentFloorBreachedMessage:
      "El saldo de tu cuenta ({balance} €) es inferior al mínimo fijado por la sociedad ({floor} €). Realiza un prepago.",
    financialSubscriptionChargeTitle: "Cuota de suscripción",
    financialSubscriptionChargeMessage: "Cuota de suscripción {month}: {amount} €.",
    stockLowAlertTitle: "Stock bajo",
    stockLowAlertMessage: "{productName}: quedan {newStock} {unit} (mínimo: {minStock}).",
    reservationBlockedBySocietyEvent:
      'No se puede reservar en esa franja: el evento "{title}" lo impide.',
    reservationBlockedKitchenByEvent:
      'No se puede usar la cocina en esta reserva: el evento "{title}" lo impide.',
    reservationBlockedTableByEvent:
      'No se puede reservar la mesa: el evento "{title}" bloquea esa mesa.',
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
    financialBankTransferValidatedTitle: "Prepayment validated",
    financialBankTransferValidatedMessage:
      "Your prepayment of {amount} € has been validated and recorded on your account.",
    financialBankTransferRejectedTitle: "Prepayment rejected",
    financialBankTransferRejectedMessage: "Your prepayment proposal was rejected. Reason: {reason}",
    financialRefundIssuedTitle: "Refund",
    financialRefundIssuedMessage: "A refund of {amount} € has been recorded on your account.",
    financialSepaBounceTitle: "Direct debit collection failed",
    financialSepaBounceMessage:
      "Your direct debit collection for {month} failed. The debt is pending again.",
    financialReservationChargeTitle: "Reservation charge",
    financialReservationChargeMessage: 'Charge for reservation "{name}": {amount} €.',
    financialPrepaymentFloorBreachedTitle: "Balance below allowed threshold",
    financialPrepaymentFloorBreachedMessage:
      "Your account balance ({balance} €) is below the society minimum ({floor} €). Please make a prepayment.",
    financialSubscriptionChargeTitle: "Subscription charge",
    financialSubscriptionChargeMessage: "Subscription charge for {month}: {amount} €.",
    stockLowAlertTitle: "Low stock",
    stockLowAlertMessage: "{productName}: {newStock} {unit} remaining (minimum: {minStock}).",
    reservationBlockedBySocietyEvent:
      'Cannot reserve in that period: the event "{title}" blocks reservations.',
    reservationBlockedKitchenByEvent:
      'Kitchen use is blocked for this reservation: the event "{title}" blocks kitchen use.',
    reservationBlockedTableByEvent:
      'Cannot reserve this table: the event "{title}" blocks that table.',
  },
};

export type TranslationKey = keyof typeof translations.eu;
