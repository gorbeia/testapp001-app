import { useEffect, useState } from "react";

/** Public marketing site only — independent from `client/src/lib/i18n` and from the signed-in app locale (`language` in localStorage). */
export type LandingLocale = "eu" | "es";

export const LANDING_LOCALE_STORAGE_KEY = "landing:locale";

const eu = {
  brandShort: "Gure Txokoa",
  productName: "Elkartearen App",
  ctaLogin: "Sartu aplikazioan",
  heroTitle: "Zure elkartearen kudeaketa digitala",
  heroSubtitle:
    "Bazkideak, erreserbak, kontsumoak, finantzak, inbentarioa eta komunikazioa — tresna bakarrean.",
  heroLead:
    "Elkartearen App elkarte gastronomiko baten eguneroko kudeaketa osoa eskaintzen du: rol-oinarritutako sarbidea, egutegi bateratua, kutxa (POS), zorrak eta SEPA, kontu-liburua, aurreordainketak, kontabilitatea, inbentarioa eta oharrak jakinarazpenekin. Interfazea euskaraz eta gaztelaniaz.",
  featuresHeading: "Zer eskaintzen duen",
  featuresSub: "Bazkideentzat eta kudeaketa-taldeentzat diseinatutako funtzionalitate nagusiak.",
  card1Title: "Bazkideak eta sarbidea",
  card1Body:
    "Kudeatu bazkideak eta lagunoak. Rol-sistemaren bidez (administratzailea, diruzaina, sotolaria, bazkidea, laguna) pertsona bakoitzak behar duena soilik ikusten du. Profil pertsonala, argazkia eta pasahitza.",
  card2Title: "Erreserbak eta egutegia",
  card2Body:
    "Egin erreserbak: mahaia, gonbidatuak, sukaldea eta mota (bazkaria, afaria, askaria, hamaiketakoa). Ikusi guztia egutegian; blokeatu erreserbak elkartea itxita dagoenean; jaialdiak eta batzarrak gainjarri.",
  card3Title: "Kontsumoak (POS)",
  card3Body:
    "Kutxa sistema erraza produktu-txarteletan, kategorietan eta argazkiekin. Ireki kontsumoa, gehitu artikuluak eta itxi; stock-a automatikoki eguneratzen da moduan. Historia pertsonala eta, konfiguratuta badago, diruarekin ordainketak.",
  card4Title: "Finantza osoa",
  card4Body:
    "Hilabeteko zorrak automatikoki (erreserbak, kontsumoak, kuotak). SEPA XML esportazioa, kontu-mugimenduen liburua, aurreordainketen proposamen eta balioztapena, itzulketak, SEPA itzulerak eta elkartearen kontabilitate propioa CSVrekin.",
  card5Title: "Inbentarioa",
  card5Body:
    "Produktuak, stock-a, hornidura-sarrerak, inbentario fisikoa, mugimenduak kontsumoetatik eta alertak stock baxuan — sotolariaren tresnak.",
  card6Title: "Komunikazioa",
  card6Body:
    "Oharrak bi hizkuntzatan eta jakinarazpenak aplikazio barruan: finantzak, stock-a eta bestelako gertaerak.",
  card7Title: "Kuota-motak",
  card7Body:
    "Definitu kuota desberdinak eta esleitu bazkideei; zenbatekoak zor-kalkuluan sartzen dira automatoki.",
  card8Title: "Bi hizkuntza",
  card8Body:
    "Interfaze osoa euskaraz eta gaztelaniaz, hizkuntza berehala aldatuz; datak eta zenbakiak tokiko formatura egokituta.",
  card9Title: "Plataforma segurua",
  card9Body:
    "JWT cookie seguruetan, pasahitzak zifratuta, multi-tenant arkitektura eta baimenak API eta interfazean.",
  summaryTitle: "Laburpen-taula: arlo eta funtzioak",
  summarySub: "Zure elkartea modu eraginkorrago kudeatzeko bildutako gaitasunak, labur.",
  tableColArea: "Arloa",
  tableColFunctions: "Funtzioak",
  tableR1Area: "Bazkideak",
  tableR1Funcs: "Alta, edizioa, rolak, lagunoak, avatar",
  tableR2Area: "Erreserbak",
  tableR2Funcs: "Sortu, ikusi; mahaia eta gonbidatuak; egutegia",
  tableR3Area: "Kontsumoak",
  tableR3Funcs: "POS txartelak, saioak, historia, ordainketak eskuragarri",
  tableR4Area: "Zorrak & SEPA",
  tableR4Funcs: "Zor automatikoa, SEPA XML, kobrantza-kadentzia",
  tableR5Area: "Mugimenduak",
  tableR5Funcs: "Liburua (ledger) pertsonala eta diruzainarena, CSV",
  tableR6Area: "Aurreordainketak",
  tableR6Funcs: "Banku-transferentziak, balioztapen/baztertze, gutxieneko saldoa",
  tableR7Area: "Kontabilitatea",
  tableR7Funcs: "Elkarteko liburu kontablea, kategoriak esportagarri",
  tableR8Area: "Inbentarioa",
  tableR8Funcs: "Produktuak, stock, hornidurak, inbentarioa, alertak",
  tableR9Area: "Komunikazioa",
  tableR9Funcs: "Oharrak (eu/es), jakinarazpenak",
  tableR10Area: "Kuotak, elkartea, segurtasuna",
  tableR10Funcs: "Kuota-motak; elkartea (logoa, mapa, ordainketa-hautua); JWT eta rol-baimenak",
  closingTitle: "Prest zure elkartearen digitalizaziorako?",
  closingBody:
    "Sartu, eta bazkideek, diruzainek eta talde operatiboak eguneroko erabilerarako prest egon.",
} as const;

const es = {
  brandShort: "Gure Txokoa",
  productName: "Elkartearen App",
  ctaLogin: "Entrar a la aplicación",
  heroTitle: "La gestión digital de tu sociedad",
  heroSubtitle:
    "Socios, reservas, consumos, finanzas, inventario y comunicación — en una sola herramienta.",
  heroLead:
    "Elkartearen App ofrece la gestión integral de una sociedad gastronómica: acceso por roles, calendario unificado, caja (TPV), deudas y SEPA, libro de movimientos, anticipos por transferencia, contabilidad de la sociedad, inventario y avisos con notificaciones. Interfaz en euskera y castellano.",
  featuresHeading: "Qué ofrece",
  featuresSub: "Funcionalidades principales para socios y equipos de gestión.",
  card1Title: "Socios y acceso",
  card1Body:
    "Gestiona socios y acompañantes. El sistema de roles (administrador, tesorero, bodeguero, socio, acompañante) asegura que cada persona vea solo lo necesario. Perfil propio, foto y contraseña.",
  card2Title: "Reservas y calendario",
  card2Body:
    "Crea reservas: mesa, invitados, cocina y tipo (comida, cena, merienda, almuerzo). Consulta todo en el calendario; bloquea reservas cuando la sociedad está cerrada; superpone fiestas y asambleas.",
  card3Title: "Consumos (TPV)",
  card3Body:
    "Caja intuitiva con tarjetas de producto, categorías e imágenes. Abre un consumo, añade líneas y cierra; el stock se actualiza según el modo. Historial personal y, si está configurado, cobro en efectivo de pendientes.",
  card4Title: "Finanzas completas",
  card4Body:
    "Deudas mensuales automáticas (reservas, consumos, cuotas). Exportación SEPA XML, libro de cuenta, propuestas de anticipo con validación, devoluciones, devoluciones SEPA y contabilidad propia de la sociedad con CSV.",
  card5Title: "Inventario",
  card5Body:
    "Productos, stock, albaranes de compra, inventario físico, movimientos por consumos y alertas de stock bajo — herramientas del bodeguero.",
  card6Title: "Comunicación",
  card6Body: "Notas en dos idiomas y notificaciones en la app: finanzas, stock y otros avisos.",
  card7Title: "Tipos de cuota",
  card7Body:
    "Define cuotas distintas y asígnalas a socios; los importes entran automáticamente en el cálculo de deuda.",
  card8Title: "Dos idiomas",
  card8Body:
    "Interfaz completa en euskera y castellano, con cambio inmediato; fechas y números con formato local.",
  card9Title: "Plataforma segura",
  card9Body:
    "JWT en cookies seguras, contraseñas cifradas, arquitectura multi-inquilino y permisos en API e interfaz.",
  summaryTitle: "Resumen: áreas y funciones",
  summarySub: "Capacidades reunidas para gestionar tu sociedad con menos fricción.",
  tableColArea: "Área",
  tableColFunctions: "Funciones",
  tableR1Area: "Socios",
  tableR1Funcs: "Alta, edición, roles, acompañantes, avatar",
  tableR2Area: "Reservas",
  tableR2Funcs: "Crear, ver; mesa e invitados; calendario",
  tableR3Area: "Consumos",
  tableR3Funcs: "TPV con tarjetas, sesiones, historial, cobros si aplica",
  tableR4Area: "Deudas y SEPA",
  tableR4Funcs: "Deuda automática, XML SEPA, cadencia de cobro",
  tableR5Area: "Movimientos",
  tableR5Funcs: "Libro mayor personal y de tesorería, CSV",
  tableR6Area: "Anticipos",
  tableR6Funcs: "Transferencias, validar/rechazar, saldo mínimo",
  tableR7Area: "Contabilidad",
  tableR7Funcs: "Libro de la sociedad, categorías exportables",
  tableR8Area: "Inventario",
  tableR8Funcs: "Productos, stock, albaranes, inventario, alertas",
  tableR9Area: "Comunicación",
  tableR9Funcs: "Notas (eu/es), notificaciones",
  tableR10Area: "Cuotas, sociedad, seguridad",
  tableR10Funcs: "Tipos de cuota; sociedad (logo, mapa, métodos de pago); JWT y permisos",
  closingTitle: "¿Listo para digitalizar tu sociedad?",
  closingBody: "Entra: socios, tesorería y operación diaria, en un solo lugar.",
} as const;

export const landingByLocale = { eu, es } as const;

export type LandingKey = keyof typeof eu;

function readStoredLocale(): LandingLocale {
  if (typeof window === "undefined") return "eu";
  const raw = window.localStorage.getItem(LANDING_LOCALE_STORAGE_KEY);
  return raw === "es" ? "es" : "eu";
}

export function useLandingI18n(): {
  locale: LandingLocale;
  setLocale: (locale: LandingLocale) => void;
  t: (key: LandingKey) => string;
} {
  const [locale, setLocale] = useState<LandingLocale>(readStoredLocale);

  useEffect(() => {
    window.localStorage.setItem(LANDING_LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  const t = (key: LandingKey) => landingByLocale[locale][key];

  return { locale, setLocale, t };
}
