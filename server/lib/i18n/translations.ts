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
  },
};

export type TranslationKey = keyof typeof translations.eu;
