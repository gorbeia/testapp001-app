import type { MailPayload, MailTransport } from "./types";
import { createSmtpTransportFromEnv, parseBoolEnv } from "./smtp-env";

function resolveFromDisplayName(payload: MailPayload): string | undefined {
  const fromPayload = payload.fromName?.trim();
  if (fromPayload) return fromPayload;
  const fromEnv = process.env.MAIL_FROM_NAME?.trim();
  return fromEnv || undefined;
}

function formatFromForPreview(payload: MailPayload): string {
  const addr = process.env.MAIL_FROM ?? "(MAIL_FROM unset)";
  const name = resolveFromDisplayName(payload);
  return name ? `"${name.replace(/"/g, "")}" <${addr}>` : addr;
}

/**
 * When `MAIL_LOG_TO_STDOUT=true`, prints a full copy of the message to the server log
 * (for staging / local validation without SMTP). Avoid in production if logs are retained and content is sensitive.
 */
export function logMailPreviewIfRequested(payload: MailPayload): void {
  if (!parseBoolEnv(process.env.MAIL_LOG_TO_STDOUT, false)) return;
  if (process.env.NODE_ENV === "test") return;

  const lines = [
    "[mail:preview] — message as it would be sent (SMTP may still apply separately)",
    `From: ${formatFromForPreview(payload)}`,
    `To: ${payload.to}`,
    payload.replyTo ? `Reply-To: ${payload.replyTo}` : null,
    `Subject: ${payload.subject}`,
    "",
    payload.text,
  ].filter((l): l is string => l != null);
  if (payload.html) {
    lines.push("", "--- html ---", payload.html);
  }
  lines.push("[mail:preview end]");
  console.info(lines.join("\n"));
}

function createNoopTransport(): MailTransport {
  return {
    async send(payload: MailPayload) {
      logMailPreviewIfRequested(payload);
      const previewOnly = parseBoolEnv(process.env.MAIL_LOG_TO_STDOUT, false);
      if (process.env.NODE_ENV === "development" && !previewOnly) {
        console.info("[mail:noop] no SMTP / MAIL_FROM — not sending", {
          to: payload.to,
          subject: payload.subject,
        });
      } else if (process.env.NODE_ENV === "development" && previewOnly) {
        console.info("[mail:noop] MAIL_LOG_TO_STDOUT captured body above; not sending over SMTP");
      }
    },
  };
}

function createNodemailerTransport(): MailTransport {
  const transporter = createSmtpTransportFromEnv();
  if (!transporter) {
    return createNoopTransport();
  }

  return {
    async send(payload: MailPayload) {
      logMailPreviewIfRequested(payload);

      const from = process.env.MAIL_FROM;
      if (!from) {
        throw new Error("MAIL_FROM is not set");
      }
      const displayName = resolveFromDisplayName(payload);

      await transporter.sendMail({
        from: displayName ? { name: displayName, address: from } : from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        replyTo: payload.replyTo,
        headers: payload.headers,
      });
    },
  };
}

let cached: MailTransport | null = null;

/**
 * Resolves the process-wide mail transport from env.
 * - EMAIL_ENABLED=false: noop (nothing sent)
 * - Missing SMTP_HOST or MAIL_FROM: noop — no email is sent; production logs a warning once.
 *   Set MAIL_LOG_TO_STDOUT=true to print full To/Subject/body to the process log for manual checks.
 */
export function getMailTransport(): MailTransport {
  if (cached) return cached;

  if (process.env.EMAIL_ENABLED === "false") {
    cached = createNoopTransport();
    return cached;
  }

  if (!process.env.SMTP_HOST || !process.env.MAIL_FROM) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[mail] SMTP_HOST or MAIL_FROM unset in production; outbound email is disabled"
      );
    }
    cached = createNoopTransport();
    return cached;
  }

  cached = createNodemailerTransport();
  return cached;
}

/** Test helper: replace the cached transport (e.g. with a mock). */
export function setMailTransportForTests(transport: MailTransport | null): void {
  cached = transport;
}
