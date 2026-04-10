import type { CommunicationLanguage } from "@shared/schema";
import { sendRawEmail } from "./send-raw";

function normalizeMailLang(raw: string | null | undefined): CommunicationLanguage {
  if (raw === "es" || raw === "en") return raw;
  return "eu";
}

function tenantLoginUrl(subdomain: string, apex: string): string {
  const secure = process.env.NODE_ENV === "production";
  return `${secure ? "https" : "http"}://${subdomain}.${apex}/sartu`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function copy(
  lang: CommunicationLanguage,
  vars: { lines: { societyName: string; url: string }[] }
): { subject: string; text: string; html: string } {
  const listText = vars.lines.map(l => `- ${l.societyName}: ${l.url}`).join("\n");
  const listHtml = vars.lines
    .map(
      l =>
        `<li><strong>${escapeHtml(l.societyName)}</strong>: <a href="${escapeHtml(l.url)}">${escapeHtml(l.url)}</a></li>`
    )
    .join("");

  if (lang === "es") {
    return {
      subject: "Tus enlaces de acceso — Elkartearen",
      text: `Hola,\n\nAquí tienes las direcciones web donde puedes iniciar sesión con tu correo:\n\n${listText}\n\nAbre el enlace de tu sociedad e inicia sesión allí.\n`,
      html: `<p>Hola,</p><p>Aquí tienes las direcciones web donde puedes iniciar sesión con tu correo:</p><ul>${listHtml}</ul><p>Abre el enlace de tu sociedad e inicia sesión allí.</p>`,
    };
  }
  if (lang === "en") {
    return {
      subject: "Your sign-in links — Elkartearen",
      text: `Hello,\n\nHere are the web addresses where you can sign in with your email:\n\n${listText}\n\nOpen your society’s link and sign in there.\n`,
      html: `<p>Hello,</p><p>Here are the web addresses where you can sign in with your email:</p><ul>${listHtml}</ul><p>Open your society’s link and sign in there.</p>`,
    };
  }
  return {
    subject: "Zure sarbide-estekak — Elkartearen",
    text: `Kaixo,\n\nHonako helbideetan saioa has dezakezu zure postarekin:\n\n${listText}\n\nIreki zure elkarteko esteka eta hasi saioa bertan.\n`,
    html: `<p>Kaixo,</p><p>Honako helbideetan saioa has dezakezu zure postarekin:</p><ul>${listHtml}</ul><p>Ireki zure elkarteko esteka eta hasi saioa bertan.</p>`,
  };
}

export async function sendSocietyAccessUrlsEmail(params: {
  to: string;
  communicationLanguage: string | null | undefined;
  apex: string;
  items: { societyName: string; subdomain: string }[];
}): Promise<void> {
  const lang = normalizeMailLang(params.communicationLanguage);
  const lines = params.items.map(i => ({
    societyName: i.societyName,
    url: tenantLoginUrl(i.subdomain, params.apex),
  }));
  const { subject, text, html } = copy(lang, { lines });
  await sendRawEmail({ to: params.to, subject, text, html });
}
