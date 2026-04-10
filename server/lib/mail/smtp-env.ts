import nodemailer from "nodemailer";

export function parseBoolEnv(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw == null || raw === "") return defaultValue;
  const v = raw.trim();
  return v === "1" || v.toLowerCase() === "true";
}

export function createSmtpTransportFromEnv(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const secure = parseBoolEnv(process.env.SMTP_SECURE, port === 465);
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
}

export type OutboundEmailConfigSnapshot = {
  emailEnabled: boolean;
  smtpHostSet: boolean;
  mailFromSet: boolean;
  smtpAuthSet: boolean;
  mailLogToStdout: boolean;
  /** True when the app would use real SMTP (same gate as getMailTransport). */
  readyForSmtp: boolean;
};

export function getOutboundEmailConfigSnapshot(): OutboundEmailConfigSnapshot {
  const emailEnabled = process.env.EMAIL_ENABLED !== "false";
  const smtpHostSet = Boolean(process.env.SMTP_HOST?.trim());
  const mailFromSet = Boolean(process.env.MAIL_FROM?.trim());
  const smtpAuthSet =
    Boolean(process.env.SMTP_USER?.trim()) && Boolean(process.env.SMTP_PASS?.trim());
  const mailLogToStdout = parseBoolEnv(process.env.MAIL_LOG_TO_STDOUT, false);
  const readyForSmtp = emailEnabled && smtpHostSet && mailFromSet;
  return {
    emailEnabled,
    smtpHostSet,
    mailFromSet,
    smtpAuthSet,
    mailLogToStdout,
    readyForSmtp,
  };
}
