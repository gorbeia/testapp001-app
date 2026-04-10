import type { CommunicationLanguage } from "@shared/schema";
import { sendRawEmail } from "./send-raw";

function resolvePublicOrigin(): string {
  const raw = process.env.APP_PUBLIC_ORIGIN?.trim().replace(/\/$/, "");
  if (raw) return raw;
  return "http://localhost:5173";
}

export function buildEmailVerificationUrl(token: string): string {
  const origin = resolvePublicOrigin();
  return `${origin}/egiaztatu-posta?token=${encodeURIComponent(token)}`;
}

function verificationCopy(
  lang: CommunicationLanguage,
  vars: { verifyUrl: string; societyName: string }
): { subject: string; text: string; html: string } {
  if (lang === "es") {
    return {
      subject: "Confirma tu correo — Elkartearen",
      text: `Hola,\n\nPara activar tu cuenta de administración de "${vars.societyName}", confirma tu correo abriendo este enlace (válido 48 h):\n\n${vars.verifyUrl}\n\nSi no has solicitado esto, ignora este mensaje.\n`,
      html: `<p>Hola,</p><p>Para activar tu cuenta de administración de <strong>${escapeHtml(vars.societyName)}</strong>, confirma tu correo:</p><p><a href="${escapeHtml(vars.verifyUrl)}">Confirmar correo</a></p><p>Si no has solicitado esto, ignora este mensaje.</p>`,
    };
  }
  return {
    subject: "Egiaztatu zure posta — Elkartearen",
    text: `Kaixo,\n\n"${vars.societyName}" elkarteko administratzaile kontua aktibatzeko, egiaztatu zure posta esteka hau irekiz (48 ordu balio-duina):\n\n${vars.verifyUrl}\n\nEz baduzu eskatu, ez ikusi mezu honi.\n`,
    html: `<p>Kaixo,</p><p><strong>${escapeHtml(vars.societyName)}</strong> elkarteko administratzaile kontua aktibatzeko, egiaztatu zure posta:</p><p><a href="${escapeHtml(vars.verifyUrl)}">Posta egiaztatu</a></p><p>Ez baduzu eskatu, ez ikusi mezu honi.</p>`,
  };
}

function welcomeCopy(
  lang: CommunicationLanguage,
  vars: { societyName: string; alphabeticId: string; loginHint: string }
): { subject: string; text: string; html: string } {
  if (lang === "es") {
    return {
      subject: `Tu espacio "${vars.societyName}" está listo`,
      text: `Hola,\n\nTu correo está verificado. Ya puedes entrar en la aplicación.\n\nSociedad (ID alfabético): ${vars.alphabeticId}\n${vars.loginHint}\n`,
      html: `<p>Hola,</p><p>Tu correo está verificado. Ya puedes entrar en la aplicación.</p><p>Sociedad (ID alfabético): <strong>${escapeHtml(vars.alphabeticId)}</strong></p><p>${escapeHtml(vars.loginHint)}</p>`,
    };
  }
  return {
    subject: `Zure "${vars.societyName}" prest dago`,
    text: `Kaixo,\n\nZure posta egiaztatuta dago. Aplikazioan sartu zaitezke.\n\nElkartea (ID alfabetikoa): ${vars.alphabeticId}\n${vars.loginHint}\n`,
    html: `<p>Kaixo,</p><p>Zure posta egiaztatuta dago. Aplikazioan sartu zaitezke.</p><p>Elkartea (ID alfabetikoa): <strong>${escapeHtml(vars.alphabeticId)}</strong></p><p>${escapeHtml(vars.loginHint)}</p>`,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendSignupVerificationEmail(params: {
  to: string;
  language: CommunicationLanguage;
  societyName: string;
  token: string;
}): Promise<void> {
  const verifyUrl = buildEmailVerificationUrl(params.token);
  const { subject, text, html } = verificationCopy(params.language, {
    verifyUrl,
    societyName: params.societyName,
  });
  await sendRawEmail({ to: params.to, subject, text, html });
}

export async function sendSignupWelcomeEmail(params: {
  to: string;
  language: CommunicationLanguage;
  societyName: string;
  alphabeticId: string;
  tenantLoginUrl: string | null;
}): Promise<void> {
  const loginHint =
    params.tenantLoginUrl != null
      ? params.language === "es"
        ? `Entrar: ${params.tenantLoginUrl}`
        : `Sartu: ${params.tenantLoginUrl}`
      : params.language === "es"
        ? "Entra desde la página de inicio de la aplicación con tu ID de sociedad."
        : "Aplikazioaren hasieratik sartu zaitezke zure elkartearen ID-arekin.";

  const { subject, text, html } = welcomeCopy(params.language, {
    societyName: params.societyName,
    alphabeticId: params.alphabeticId,
    loginHint,
  });
  await sendRawEmail({ to: params.to, subject, text, html });
}
