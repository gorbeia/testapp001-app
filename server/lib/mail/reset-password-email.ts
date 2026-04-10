import type { CommunicationLanguage } from "@shared/schema";
import { resolvePublicOriginForMail } from "./resolve-public-origin";
import { sendRawEmail } from "./send-raw";

function tenantAppOrigin(subdomain: string | null, apex: string | null): string | null {
  if (!subdomain || !apex) return null;
  const secure = process.env.NODE_ENV === "production";
  return `${secure ? "https" : "http"}://${subdomain}.${apex}`;
}

export function buildResetPasswordUrl(
  token: string,
  opts: { subdomain: string | null; apex: string | null }
): string {
  const tenant = tenantAppOrigin(opts.subdomain, opts.apex);
  const base = (tenant ?? resolvePublicOriginForMail()).replace(/\/$/, "");
  return `${base}/pasahitza-berrezarri?token=${encodeURIComponent(token)}`;
}

function normalizeMailLang(raw: string | null | undefined): CommunicationLanguage {
  if (raw === "es" || raw === "en") return raw;
  return "eu";
}

function copy(
  lang: CommunicationLanguage,
  vars: { resetUrl: string; societyName: string }
): { subject: string; text: string; html: string } {
  if (lang === "es") {
    return {
      subject: "Restablecer contraseña — Elkartetippia",
      text: `Hola,\n\nAlguien solicitó restablecer la contraseña de tu cuenta en "${vars.societyName}". Abre este enlace (válido 1 h):\n\n${vars.resetUrl}\n\nSi no fuiste tú, ignora este mensaje.\n`,
      html: `<p>Hola,</p><p>Se solicitó restablecer la contraseña de tu cuenta en <strong>${escapeHtml(vars.societyName)}</strong>:</p><p><a href="${escapeHtml(vars.resetUrl)}">Restablecer contraseña</a></p><p>Si no fuiste tú, ignora este mensaje.</p>`,
    };
  }
  if (lang === "en") {
    return {
      subject: "Reset your password — Elkartetippia",
      text: `Hello,\n\nSomeone requested a password reset for your account in "${vars.societyName}". Open this link (valid 1 hour):\n\n${vars.resetUrl}\n\nIf you did not request this, ignore this message.\n`,
      html: `<p>Hello,</p><p>Someone requested a password reset for your account in <strong>${escapeHtml(vars.societyName)}</strong>:</p><p><a href="${escapeHtml(vars.resetUrl)}">Reset password</a></p><p>If you did not request this, ignore this message.</p>`,
    };
  }
  return {
    subject: "Pasahitza berrezarri — Elkartetippia",
    text: `Kaixo,\n\n"${vars.societyName}" elkarteko konturako pasahitza berrezartzeko eskaera egin da. Esteka hau ireki (1 ordu balio-duina):\n\n${vars.resetUrl}\n\nEz baduzu eskatu, ez ikusi mezu honi.\n`,
    html: `<p>Kaixo,</p><p><strong>${escapeHtml(vars.societyName)}</strong> elkarteko konturako pasahitza berrezartzeko eskaera egin da:</p><p><a href="${escapeHtml(vars.resetUrl)}">Pasahitza berrezarri</a></p><p>Ez baduzu eskatu, ez ikusi mezu honi.</p>`,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendPasswordResetEmail(params: {
  to: string;
  communicationLanguage: string | null | undefined;
  societyName: string;
  subdomain: string | null;
  apex: string | null;
  token: string;
}): Promise<void> {
  const lang = normalizeMailLang(params.communicationLanguage);
  const resetUrl = buildResetPasswordUrl(params.token, {
    subdomain: params.subdomain,
    apex: params.apex,
  });
  const { subject, text, html } = copy(lang, { resetUrl, societyName: params.societyName });
  await sendRawEmail({ to: params.to, subject, text, html });
}
