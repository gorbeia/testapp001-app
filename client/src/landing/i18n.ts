import { useEffect, useState } from "react";

/** Public marketing site only — independent from `client/src/lib/i18n` and from the signed-in app locale (`language` in localStorage). */
export type LandingLocale = "eu" | "es";

export const LANDING_LOCALE_STORAGE_KEY = "landing:locale";

/** Public path when subdomain multitenancy: how to reach an existing society. */
export const LANDING_ACCESS_SOCIETY_PATH = "/elkartea-sartu";

const eu = {
  brandShort: "Elkartetippia",
  brandInitials: "Et",
  productName: "Elkarteen kudeaketa",
  ctaLogin: "Sartu aplikazioan",
  heroTitle: "Zure elkartearen kudeaketa digitala",
  heroSubtitle:
    "Bazkideak, erreserbak, kontsumoak, finantzak, inbentarioa eta komunikazioa — tresna bakarrean.",
  heroLead:
    "Elkartetippia elkarte gastronomiko baten eguneroko kudeaketa osoa eskaintzen du: rol-oinarritutako sarbidea, egutegi bateratua, kutxa (POS), zorrak eta SEPA, kontu-liburua, aurreordainketak, kontabilitatea, inbentarioa eta oharrak jakinarazpenekin. Interfazea euskaraz eta gaztelaniaz.",
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
  ctaCreateSociety: "Sortu zure elkartea",
  ctaAccessSociety: "Badut elkartea — sartu",
  signupBackHome: "Hasierara itzuli",
  signupTitle: "Konfiguratu zure elkartea",
  signupSubtitle:
    "Betetu datuak, egiaztatu posta elektronikoa eta hasi saioa zure kudeaketa-ingurunean.",
  signupSectionSociety: "Elkartea",
  signupSectionWeb: "Web helbidea",
  signupSectionAdmin: "Administratzailea",
  signupFieldSocietyName: "Elkarteko izena",
  signupFieldShortDescription: "Deskribapen laburra (aukerakoa)",
  signupFieldAcronym: "Akronimoa, gehienez 3 letra (aukerakoa)",
  signupFieldSocietyEmail: "Elkarteko kontaktu-posta (aukerakoa)",
  signupFieldSocietyPhone: "Telefonoa (aukerakoa)",
  signupFieldSocietyAddress: "Helbidea (aukerakoa)",
  signupFieldSubdomain: "Azpidomeinua",
  signupSubdomainRequired: "Idatzi azpidomeinu bat.",
  signupTermsRequired: "Onartu behar dituzu baldintzak.",
  signupSubdomainHint: "Zure saioa helbide honetan egongo da:",
  signupSubdomainChecking: "Egiaztatzen…",
  signupSubdomainAvailable: "Erabilgarri",
  signupSubdomainTakenOrInvalid: "Hartuta edo baliogabea",
  signupFieldAdminName: "Izen osoa",
  signupFieldAdminEmail: "Posta elektronikoa (saio-hasiera)",
  signupFieldAdminPassword: "Pasahitza (gutxienez 8 karaktere)",
  signupFieldAdminPasswordConfirm: "Errepikatu pasahitza",
  signupMarketingOptIn:
    "Nahi dut Elkartetippia-ko berriak eta garapenak jaso (borondatezko harpidetza).",
  signupAcceptTerms: "Onartzen ditut erabilera-baldintzak eta pribatutasun-politika.",
  signupTermsLink: "Baldintzak",
  signupPrivacyLink: "Pribatutasuna",
  signupSubmit: "Sortu elkartea",
  signupSubmitting: "Sortzen…",
  signupErrorGeneric: "Ezin izan da elkartea sortu. Saiatu berriro.",
  signupSuccessCheckEmail:
    "Mezu bat bidali dizugu posta egiaztatzeko. Egiaztatu ondoren hasi saioa.",
  signupSuccessAlphabeticId: "Elkartearen ID alfabetikoa:",
  signupGoLogin: "Joan saio-hasierara",
  signupPasswordMismatch: "Pasahitzak ez datoz bat",
  verifyEmailTitle: "Posta egiaztatzen",
  verifyEmailMissingToken: "Esteka baliogabea.",
  verifyEmailSuccess: "Posta egiaztatuta. Orain saioa has dezakezu.",
  verifyEmailError: "Esteka baliogabea edo iraungita.",
  verifyEmailGoLogin: "Saio-hasierara",
  accessSocietyTitle: "Sartu zure elkartean",
  accessSocietyIntro:
    "Saioa elkarteko helbidean bakarrik has daiteke: https://{azpidomeinua}.{domeinua} — ez nagusian.",
  accessSocietyEmailLabel: "Posta elektronikoa (saio-hasiera)",
  accessSocietySubmit: "Bidali sarbide-estekak",
  accessSocietySubmitting: "Bidaltzen…",
  accessSocietySuccess:
    "Mezu bat bidali badizugu (sarbidea baduzu), bertan agertuko dira zure elkarteen estekak. Ez baduzu jasotzen, egiaztatu spam-a.",
  accessSocietyErrorGeneric: "Ezin izan da eskaera prozesatu. Saiatu berriro.",
  accessSocietyTooManyRequests: "Eskaera gehiegi. Saiatu beranduago.",
  accessSocietyBackHome: "Hasierara",
} as const;

const es = {
  brandShort: "Elkartetippia",
  brandInitials: "Et",
  productName: "Gestión de sociedades gastronómicas",
  ctaLogin: "Entrar a la aplicación",
  heroTitle: "La gestión digital de tu sociedad",
  heroSubtitle:
    "Socios, reservas, consumos, finanzas, inventario y comunicación — en una sola herramienta.",
  heroLead:
    "Elkartetippia ofrece la gestión integral de una sociedad gastronómica: acceso por roles, calendario unificado, caja (TPV), deudas y SEPA, libro de movimientos, anticipos por transferencia, contabilidad de la sociedad, inventario y avisos con notificaciones. Interfaz en euskera y castellano.",
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
  ctaCreateSociety: "Crea tu sociedad",
  ctaAccessSociety: "Ya tengo sociedad — acceder",
  signupBackHome: "Volver al inicio",
  signupTitle: "Configura tu sociedad",
  signupSubtitle: "Completa los datos, verifica tu correo y accede a tu espacio de gestión.",
  signupSectionSociety: "Sociedad",
  signupSectionWeb: "Dirección web",
  signupSectionAdmin: "Administrador",
  signupFieldSocietyName: "Nombre de la sociedad",
  signupFieldShortDescription: "Descripción breve (opcional)",
  signupFieldAcronym: "Acrónimo, hasta 3 letras (opcional)",
  signupFieldSocietyEmail: "Correo de contacto de la sociedad (opcional)",
  signupFieldSocietyPhone: "Teléfono (opcional)",
  signupFieldSocietyAddress: "Dirección (opcional)",
  signupFieldSubdomain: "Subdominio",
  signupSubdomainRequired: "Indica un subdominio.",
  signupTermsRequired: "Debes aceptar los términos.",
  signupSubdomainHint: "Tu acceso estará en:",
  signupSubdomainChecking: "Comprobando…",
  signupSubdomainAvailable: "Disponible",
  signupSubdomainTakenOrInvalid: "No disponible o no válido",
  signupFieldAdminName: "Nombre completo",
  signupFieldAdminEmail: "Correo electrónico (inicio de sesión)",
  signupFieldAdminPassword: "Contraseña (mín. 8 caracteres)",
  signupFieldAdminPasswordConfirm: "Repetir contraseña",
  signupMarketingOptIn: "Quiero recibir novedades y actualizaciones de Elkartetippia (opcional).",
  signupAcceptTerms: "Acepto los términos de uso y la política de privacidad.",
  signupTermsLink: "Términos",
  signupPrivacyLink: "Privacidad",
  signupSubmit: "Crear sociedad",
  signupSubmitting: "Creando…",
  signupErrorGeneric: "No se ha podido crear la sociedad. Inténtalo de nuevo.",
  signupSuccessCheckEmail:
    "Te hemos enviado un correo para verificar tu cuenta. Verifica y luego inicia sesión.",
  signupSuccessAlphabeticId: "ID alfabético de la sociedad:",
  signupGoLogin: "Ir al inicio de sesión",
  signupPasswordMismatch: "Las contraseñas no coinciden",
  verifyEmailTitle: "Verificando correo",
  verifyEmailMissingToken: "Enlace no válido.",
  verifyEmailSuccess: "Correo verificado. Ya puedes iniciar sesión.",
  verifyEmailError: "Enlace no válido o caducado.",
  verifyEmailGoLogin: "Inicio de sesión",
  accessSocietyTitle: "Acceder a tu sociedad",
  accessSocietyIntro:
    "El inicio de sesión solo está disponible en la dirección web de tu sociedad: https://{subdominio}.{dominio} — no en el sitio principal.",
  accessSocietyEmailLabel: "Correo electrónico (inicio de sesión)",
  accessSocietySubmit: "Enviar enlaces de acceso",
  accessSocietySubmitting: "Enviando…",
  accessSocietySuccess:
    "Si tu correo tiene acceso, te hemos enviado un mensaje con los enlaces de tus sociedades. Revisa también spam.",
  accessSocietyErrorGeneric: "No se ha podido procesar la solicitud. Inténtalo de nuevo.",
  accessSocietyTooManyRequests: "Demasiadas solicitudes. Prueba más tarde.",
  accessSocietyBackHome: "Inicio",
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
