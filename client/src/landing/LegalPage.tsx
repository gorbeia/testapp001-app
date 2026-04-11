import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LandingLanguageToggle } from "@/landing/LandingLanguageToggle";
import { useLandingI18n, type LandingLocale } from "@/landing/i18n";

// ---------------------------------------------------------------------------
// Full legal copy lives here (not in landing/i18n.ts) because it's long-form
// prose that doesn't benefit from the short-key translation model.
// ---------------------------------------------------------------------------

const COMPANY = "Elkartetippia";
const COMPANY_LEGAL =
  "'URDUÑAKO HARRESIA' KULTURA, AISIALDI, KIROL ETA GASTRONOMIA ELKARTEA";
const NIF = "G25883182";
const ADDRESS = "Burdin kalea 3, 48460, Urduña, Bizkaia";
const EMAIL = "urdunakoharresia@gmail.com";

// ── Terms of Use ──────────────────────────────────────────────────────────

function TermsEu() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Erabilera-baldintzak</h1>
      <p className="mt-1 text-sm text-muted-foreground">Azken eguneraketa: 2026-04-11</p>

      <section className="mt-8 space-y-4 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">1. Identifikazioa (LSSI-CE 10. art.)</h2>
        <p>
          Webgune hau {COMPANY_LEGAL} entitateak kudeatzen du, IFK {NIF}, egoitza soziala{" "}
          {ADDRESS}, e-posta {EMAIL}. Bizkaiko Lurralde Historikoko Elkarteen Erregistroan
          inskribatuta.
        </p>

        <h2 className="text-lg font-semibold">2. Xedea</h2>
        <p>
          {COMPANY}k plataforma digital bat eskaintzen du elkarte gastronomikoen kudeaketarako:
          bazkideen altak, erreserbak, kontsumoak (POS), finantza-kudeaketa, inbentarioa eta
          komunikazioa. Zerbitzu hau kontratatzean, erabiltzaileak baldintza hauek onartzen ditu.
        </p>

        <h2 className="text-lg font-semibold">3. Erregistroa eta kontuak</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Erabiltzaileak datu zehatzak eta eguneratutakoak eman behar ditu.</li>
          <li>
            Kontu bakoitzari elkarte bat (tenant) lotuta dago. Administratzaileak bere elkarteko
            erabiltzaile-kontuak kudeatzen ditu.
          </li>
          <li>
            Pasahitzaren konfidentzialtasuna erabiltzailearen ardura da. Erabilera
            desegokia susmatzean, berehala jakinarazi <em>{EMAIL}</em> helbidera.
          </li>
        </ul>

        <h2 className="text-lg font-semibold">4. Erabilera onargarria</h2>
        <p>Debekatuta dago:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Plataforma legez kanpoko, iraingarri, diskriminatzaile edo kaltegarri helburuz erabiltzea.</li>
          <li>Segurtasun-neurriak edo sarbide-kontrolak saihesten saiatzea.</li>
          <li>Hirugarrenen datu pertsonalak plataformara baimenik gabe igotzea.</li>
        </ul>

        <h2 className="text-lg font-semibold">5. Jabetza intelektuala</h2>
        <p>
          {COMPANY} plataformaren softwarea, diseinua, logoak eta edukia jabetza intelektualaren
          legeek babesten dute. Erabiltzaileak plataforman sartutako datuak bere jabetzakoak dira.
        </p>

        <h2 className="text-lg font-semibold">6. Zerbitzuaren erabilgarritasuna</h2>
        <p>
          {COMPANY}k ahalegina egingo du zerbitzua etengabe eskaintzeko, baina ez du
          erabilgarritasun etenikoa bermatzen. Mantentze-lanak aldez aurretik jakinarazi
          daitezke. Matxura larriengatiko kalteak ez dira {COMPANY}ren erantzukizuna, legeek
          ezarritako mugen barruan.
        </p>

        <h2 className="text-lg font-semibold">7. Prezioak eta ordainketa</h2>
        <p>
          Hasierako erregistroa doakoa da. Etorkizunean premium funtzionalitateak kobra daitezke;
          kasu horretan, aurretik jakinaraziko da eta onarpen esplizitua eskatuko da.
        </p>

        <h2 className="text-lg font-semibold">8. Baja eta datuen ezabaketa</h2>
        <p>
          Erabiltzaileak edozein unetan eska dezake kontuaren eta elkartearen baja{" "}
          <em>{EMAIL}</em> helbidera idatziz. Bajarengatik, datuak ezabatuko dira legeak
          ezarritako epean (ikus Pribatutasun Politika).
        </p>

        <h2 className="text-lg font-semibold">9. Erantzukizun-mugaketa</h2>
        <p>
          {COMPANY}k ez du erantzukizunik hartzen plataformako edukien zehaztasunagatik,
          erabiltzaileek sartutako datuen egokitasunagatik, edo konexio-arazoengatik.
          Zeharkako kalteengatiko erantzukizuna baztertzen da indarrean dagoen legediak
          ahalbidetzen duen neurrian.
        </p>

        <h2 className="text-lg font-semibold">10. Lege aplikagarria eta jurisdikzioa</h2>
        <p>
          Baldintza hauek Espainiako legeriaren arabera arautzen dira. Alderdiek Bilboko
          epaitegi eta auzitegien jurisdikzioari men egiten diote, legez derrigorrezkoa den
          forua salbu.
        </p>

        <h2 className="text-lg font-semibold">11. Aldaketak</h2>
        <p>
          {COMPANY}k baldintza hauek aldatzeko eskubidea du. Aldaketa esanguratsuak erabiltzaileei
          jakinaraziko zaizkie plataformaren bidez edo posta elektronikoz.
        </p>
      </section>
    </>
  );
}

function TermsEs() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Condiciones de uso</h1>
      <p className="mt-1 text-sm text-muted-foreground">Última actualización: 2026-04-11</p>

      <section className="mt-8 space-y-4 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">1. Identificación (art. 10 LSSI-CE)</h2>
        <p>
          Este sitio web es titularidad de {COMPANY_LEGAL}, NIF {NIF}, domicilio social en{" "}
          {ADDRESS}, correo electrónico {EMAIL}. Inscrita en el Registro de Asociaciones del
          Territorio Histórico de Bizkaia.
        </p>

        <h2 className="text-lg font-semibold">2. Objeto</h2>
        <p>
          {COMPANY} ofrece una plataforma digital para la gestión de sociedades gastronómicas:
          alta de socios, reservas, consumos (TPV), finanzas, inventario y comunicación. Al
          registrarse, el usuario acepta las presentes condiciones.
        </p>

        <h2 className="text-lg font-semibold">3. Registro y cuentas</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>El usuario debe facilitar datos veraces y actualizados.</li>
          <li>
            Cada cuenta está vinculada a una sociedad (tenant). El administrador gestiona los
            usuarios de su sociedad.
          </li>
          <li>
            La confidencialidad de la contraseña es responsabilidad del usuario. Ante cualquier
            sospecha de uso indebido, comuníquelo de inmediato a <em>{EMAIL}</em>.
          </li>
        </ul>

        <h2 className="text-lg font-semibold">4. Uso aceptable</h2>
        <p>Queda prohibido:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Utilizar la plataforma con fines ilícitos, ofensivos, discriminatorios o dañinos.</li>
          <li>Intentar eludir las medidas de seguridad o los controles de acceso.</li>
          <li>Subir datos personales de terceros sin su consentimiento.</li>
        </ul>

        <h2 className="text-lg font-semibold">5. Propiedad intelectual</h2>
        <p>
          El software, diseño, logotipos y contenidos de {COMPANY} están protegidos por la
          legislación de propiedad intelectual e industrial. Los datos introducidos por el usuario
          en la plataforma son de su titularidad.
        </p>

        <h2 className="text-lg font-semibold">6. Disponibilidad del servicio</h2>
        <p>
          {COMPANY} realizará esfuerzos razonables para mantener el servicio disponible de forma
          continua, si bien no garantiza la ausencia de interrupciones. Las tareas de mantenimiento
          programado se comunicarán con antelación razonable. {COMPANY} no será responsable de
          daños derivados de interrupciones fuera de su control, en la medida permitida por la ley.
        </p>

        <h2 className="text-lg font-semibold">7. Precios y pago</h2>
        <p>
          El registro inicial es gratuito. En el futuro podrán ofrecerse funcionalidades premium de
          pago; en tal caso se informará previamente y se requerirá aceptación expresa.
        </p>

        <h2 className="text-lg font-semibold">8. Baja y supresión de datos</h2>
        <p>
          El usuario puede solicitar la baja de su cuenta y sociedad en cualquier momento
          escribiendo a <em>{EMAIL}</em>. Tras la baja, los datos se eliminarán en el plazo
          legalmente establecido (véase la Política de Privacidad).
        </p>

        <h2 className="text-lg font-semibold">9. Limitación de responsabilidad</h2>
        <p>
          {COMPANY} no se responsabiliza de la exactitud de los contenidos introducidos por los
          usuarios, ni de los daños derivados de problemas de conexión ajenos a la plataforma.
          La responsabilidad por daños indirectos queda excluida en la medida que la legislación
          vigente lo permita.
        </p>

        <h2 className="text-lg font-semibold">10. Legislación aplicable y jurisdicción</h2>
        <p>
          Las presentes condiciones se rigen por la legislación española. Las partes se someten a
          los Juzgados y Tribunales de Bilbao, salvo fuero legalmente imperativo.
        </p>

        <h2 className="text-lg font-semibold">11. Modificaciones</h2>
        <p>
          {COMPANY} se reserva el derecho de modificar estas condiciones. Los cambios sustanciales
          se comunicarán a los usuarios a través de la plataforma o por correo electrónico.
        </p>
      </section>
    </>
  );
}

// ── Privacy Policy ────────────────────────────────────────────────────────

function PrivacyEu() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Pribatutasun-politika</h1>
      <p className="mt-1 text-sm text-muted-foreground">Azken eguneraketa: 2026-04-11</p>

      <section className="mt-8 space-y-4 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">
          1. Arduraduna (DBEO 13-14. art. / LOPDGDD)
        </h2>
        <p>
          Tratamenduaren arduraduna: {COMPANY_LEGAL}, IFK {NIF}, helbidea {ADDRESS}.
          Harremanetarako: <em>{EMAIL}</em>.
        </p>

        <h2 className="text-lg font-semibold">2. Jasotzen diren datuak</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Erregistroan:</strong> izen osoa, helbide elektronikoa, pasahitza (zifratu
            ondoren gordetzen da), elkarteko izena eta aukerako datuak (telefonoa, helbidea,
            deskribapen laburra, azpidomeinua).
          </li>
          <li>
            <strong>Erabileran:</strong> erreserbak, kontsumoak, finantza-mugimenduak, komunikazioak
            eta inbentario-erregistroak erabiltzaileak berak sartzen ditu plataforman.
          </li>
          <li>
            <strong>Teknikoak:</strong> IP helbidea, sarbide-tokena (JWT cookie seguruan),
            nabigatzailearen oinarrizko datuak erregistroen eta segurtasunaren aldetik.
          </li>
          <li>
            <strong>Marketing opt-in:</strong> Erabiltzaileak borondatez markatzen badu
            komunikazio komertzialak jasotzeko.
          </li>
        </ul>

        <h2 className="text-lg font-semibold">3. Tratamenduaren oinarri juridikoa</h2>
        <table className="w-full border text-xs">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-2 text-left font-medium">Helburua</th>
              <th className="px-3 py-2 text-left font-medium">Oinarria (DBEO 6. art.)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="px-3 py-2">Zerbitzuaren prestazioa</td>
              <td className="px-3 py-2">Kontratuaren betearazpena (6.1.b)</td>
            </tr>
            <tr className="border-b">
              <td className="px-3 py-2">Kontu eta segurtasun kudeaketa</td>
              <td className="px-3 py-2">Interes legitimoa (6.1.f)</td>
            </tr>
            <tr className="border-b">
              <td className="px-3 py-2">Komunikazio komertzialak (opt-in)</td>
              <td className="px-3 py-2">Adostasuna (6.1.a)</td>
            </tr>
            <tr className="border-b">
              <td className="px-3 py-2">Legezko betebeharrak (fakturazio, fiskala)</td>
              <td className="px-3 py-2">Legezko betebeharra (6.1.c)</td>
            </tr>
          </tbody>
        </table>

        <h2 className="text-lg font-semibold">4. Datuen kontserbazioa</h2>
        <p>
          Datuak kontu aktiboa den bitartean gordetzen dira. Baja eman ondoren, legez
          derrigorrezkoak diren datuak gordeko dira (adib. fakturazio-datuak 4 urte, Merkataritza
          Kodea; zerga-datuak 4 urte, Zerga Lege Orokorra) eta gero ezabatuko dira.
        </p>

        <h2 className="text-lg font-semibold">5. Hartzaileak eta transferentzia internazionalak</h2>
        <p>
          Datuak ez zaizkie hirugarrenei lagako, legezko betebeharrak salbu. Zerbitzariak
          Europar Batasunean kokatzen dira. Etorkizunean kanpoko zerbitzuren bat erabiltzen bada,
          DBEO 46. artikuluko bermeak betetzen direla ziurtatuko da.
        </p>

        <h2 className="text-lg font-semibold">6. Erabiltzailearen eskubideak</h2>
        <p>DBEO 15-22. artikuluek aitortutako eskubideak:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Sarbidea: zure datuak ezagutzeko.</li>
          <li>Zuzentzea: okerrak zuzentzeko.</li>
          <li>Ezabatzea («ahaztua izateko eskubidea»).</li>
          <li>Mugatzea: tratamendua mugatzeko.</li>
          <li>Eramangarritasuna: datuak formatu egituratu batean jasotzeko.</li>
          <li>Aurka egitea: tratamenduaren aurka egiteko.</li>
        </ul>
        <p>
          Eskaerak <em>{EMAIL}</em> helbidera bidal daitezke, identifikazio-dokumentuarekin.
          Erantzuna gehienez 30 egunetan. Ados ez bazaude, erreklamazioa aurkeztu dezakezu
          Datuak Babesteko Espainiako Agentzian (AEPD, <em>www.aepd.es</em>).
        </p>

        <h2 className="text-lg font-semibold">7. Segurtasun-neurriak</h2>
        <p>
          Pasahitzak hash bidez gordetzen dira (bcrypt). Sarbidea JWT bidez, cookie seguruetan
          (httpOnly, SameSite). HTTPS komunikazio guztietan. Sarbide-kontrola rol-sistemaren
          bidez (admin, diruzaina, sotolaria, bazkidea, laguna). Tenant isolamendua multi-tenant
          arkitekturan.
        </p>

        <h2 className="text-lg font-semibold">8. Cookieak</h2>
        <p>
          Plataformak funtzionaltasun-cookieak erabiltzen ditu soilik (auth-token,
          refresh-token, hizkuntza-lehentasuna). Ez dira publizitate- edo jarraibide-cookieak
          erabiltzen. Beraz, ez da cookie-bannerra behar LSSI-CE 22.2 artikuluaren arabera.
        </p>

        <h2 className="text-lg font-semibold">9. Adingabekoak</h2>
        <p>
          Zerbitzua 16 urtetik gorakoentzat da. 16 urte baino gutxiago baduzu, ez zaitez
          erregistratu gurasoaren edo tutorearen baimenik gabe (LOPDGDD 7. art.).
        </p>
      </section>
    </>
  );
}

function PrivacyEs() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Política de privacidad</h1>
      <p className="mt-1 text-sm text-muted-foreground">Última actualización: 2026-04-11</p>

      <section className="mt-8 space-y-4 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">
          1. Responsable del tratamiento (arts. 13-14 RGPD / LOPDGDD)
        </h2>
        <p>
          Responsable: {COMPANY_LEGAL}, NIF {NIF}, domicilio {ADDRESS}. Contacto:{" "}
          <em>{EMAIL}</em>.
        </p>

        <h2 className="text-lg font-semibold">2. Datos recogidos</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>En el registro:</strong> nombre completo, correo electrónico, contraseña
            (almacenada cifrada), nombre de la sociedad y datos opcionales (teléfono, dirección,
            descripción breve, subdominio).
          </li>
          <li>
            <strong>Durante el uso:</strong> reservas, consumos, movimientos financieros,
            comunicaciones e inventario introducidos por el propio usuario.
          </li>
          <li>
            <strong>Datos técnicos:</strong> dirección IP, token de sesión (JWT en cookie segura),
            datos básicos del navegador con fines de seguridad y registro.
          </li>
          <li>
            <strong>Marketing opt-in:</strong> si el usuario marca voluntariamente la casilla para
            recibir comunicaciones comerciales.
          </li>
        </ul>

        <h2 className="text-lg font-semibold">3. Base jurídica del tratamiento</h2>
        <table className="w-full border text-xs">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-2 text-left font-medium">Finalidad</th>
              <th className="px-3 py-2 text-left font-medium">Base (art. 6 RGPD)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="px-3 py-2">Prestación del servicio</td>
              <td className="px-3 py-2">Ejecución de contrato (6.1.b)</td>
            </tr>
            <tr className="border-b">
              <td className="px-3 py-2">Gestión de cuentas y seguridad</td>
              <td className="px-3 py-2">Interés legítimo (6.1.f)</td>
            </tr>
            <tr className="border-b">
              <td className="px-3 py-2">Comunicaciones comerciales (opt-in)</td>
              <td className="px-3 py-2">Consentimiento (6.1.a)</td>
            </tr>
            <tr className="border-b">
              <td className="px-3 py-2">Obligaciones legales (facturación, fiscal)</td>
              <td className="px-3 py-2">Obligación legal (6.1.c)</td>
            </tr>
          </tbody>
        </table>

        <h2 className="text-lg font-semibold">4. Conservación de datos</h2>
        <p>
          Los datos se conservan mientras la cuenta permanezca activa. Tras la baja, se mantendrán
          los datos legalmente exigibles (p. ej. datos de facturación 4 años, Código de Comercio;
          datos fiscales 4 años, Ley General Tributaria) y posteriormente se suprimirán.
        </p>

        <h2 className="text-lg font-semibold">5. Destinatarios y transferencias internacionales</h2>
        <p>
          No se cederán datos a terceros salvo obligación legal. Los servidores se ubican en la
          Unión Europea. Si en el futuro se utilizara algún servicio externo, se garantizará el
          cumplimiento de las garantías del artículo 46 del RGPD.
        </p>

        <h2 className="text-lg font-semibold">6. Derechos del usuario</h2>
        <p>Derechos reconocidos en los artículos 15-22 del RGPD:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Acceso: conocer sus datos personales.</li>
          <li>Rectificación: corregir datos inexactos.</li>
          <li>Supresión («derecho al olvido»).</li>
          <li>Limitación: restringir el tratamiento.</li>
          <li>Portabilidad: recibir sus datos en formato estructurado.</li>
          <li>Oposición: oponerse al tratamiento.</li>
        </ul>
        <p>
          Las solicitudes se dirigirán a <em>{EMAIL}</em>, acompañadas de documento identificativo.
          Plazo de respuesta: máximo 30 días. Si no queda satisfecho, puede presentar reclamación
          ante la Agencia Española de Protección de Datos (AEPD, <em>www.aepd.es</em>).
        </p>

        <h2 className="text-lg font-semibold">7. Medidas de seguridad</h2>
        <p>
          Las contraseñas se almacenan con hash (bcrypt). El acceso se gestiona mediante JWT en
          cookies seguras (httpOnly, SameSite). Todas las comunicaciones se cifran con HTTPS.
          Control de acceso por roles (administrador, tesorero, bodeguero, socio, acompañante).
          Aislamiento de datos por sociedad (arquitectura multi-tenant).
        </p>

        <h2 className="text-lg font-semibold">8. Cookies</h2>
        <p>
          La plataforma utiliza únicamente cookies funcionales (auth-token, refresh-token,
          preferencia de idioma). No se emplean cookies publicitarias ni de seguimiento. Conforme
          al artículo 22.2 de la LSSI-CE, no se requiere banner de cookies al ser estrictamente
          necesarias para el servicio.
        </p>

        <h2 className="text-lg font-semibold">9. Menores</h2>
        <p>
          El servicio está dirigido a mayores de 16 años. Si eres menor de 16 años, no te
          registres sin la autorización de tu padre, madre o tutor legal (art. 7 LOPDGDD).
        </p>
      </section>
    </>
  );
}

// ── Shell layout ──────────────────────────────────────────────────────────

function LegalShell({
  locale,
  setLocale,
  children,
}: {
  locale: LandingLocale;
  setLocale: (l: LandingLocale) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground" lang={locale}>
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {locale === "eu" ? "Hasierara" : "Inicio"}
          </Link>
          <div className="flex items-center gap-2">
            <LandingLanguageToggle locale={locale} onLocaleChange={setLocale} />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">{children}</main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        {COMPANY} — {locale === "eu" ? "Elkarteen kudeaketa" : "Gestión de sociedades gastronómicas"}
      </footer>
    </div>
  );
}

// ── Exported pages ────────────────────────────────────────────────────────

export function TermsPage() {
  const { locale, setLocale } = useLandingI18n();
  return (
    <LegalShell locale={locale} setLocale={setLocale}>
      {locale === "eu" ? <TermsEu /> : <TermsEs />}
    </LegalShell>
  );
}

export function PrivacyPage() {
  const { locale, setLocale } = useLandingI18n();
  return (
    <LegalShell locale={locale} setLocale={setLocale}>
      {locale === "eu" ? <PrivacyEu /> : <PrivacyEs />}
    </LegalShell>
  );
}
