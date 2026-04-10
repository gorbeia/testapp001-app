import { createSmtpTransportFromEnv, getOutboundEmailConfigSnapshot } from "./smtp-env";

export type BackofficeMailTestErrorCode =
  | "EMAIL_DISABLED"
  | "NOT_CONFIGURED"
  | "VERIFY_FAILED"
  | "SEND_FAILED";

export class BackofficeMailTestError extends Error {
  readonly code: BackofficeMailTestErrorCode;

  constructor(code: BackofficeMailTestErrorCode, message: string) {
    super(message);
    this.name = "BackofficeMailTestError";
    this.code = code;
  }
}

/**
 * Verifies SMTP (connection/auth) and sends a single test message. Used by backoffice only.
 */
export async function verifyAndSendBackofficeTestEmail(to: string): Promise<void> {
  const snap = getOutboundEmailConfigSnapshot();

  if (!snap.emailEnabled) {
    throw new BackofficeMailTestError(
      "EMAIL_DISABLED",
      "Outbound email is disabled (EMAIL_ENABLED=false on the server)."
    );
  }

  if (!snap.smtpHostSet || !snap.mailFromSet) {
    throw new BackofficeMailTestError(
      "NOT_CONFIGURED",
      "Set SMTP_HOST and MAIL_FROM in the server environment before sending."
    );
  }

  const transport = createSmtpTransportFromEnv();
  if (!transport) {
    throw new BackofficeMailTestError(
      "NOT_CONFIGURED",
      "SMTP_HOST is missing or invalid; cannot create a transport."
    );
  }

  const from = process.env.MAIL_FROM!.trim();
  const displayName = process.env.MAIL_FROM_NAME?.trim() || "Elkartetippia backoffice";

  try {
    await transport.verify();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "SMTP verify failed.";
    throw new BackofficeMailTestError("VERIFY_FAILED", msg);
  }

  try {
    await transport.sendMail({
      from: { name: displayName, address: from },
      to,
      subject: `[Backoffice test] Outbound email — ${new Date().toISOString()}`,
      text: [
        "This is a test message from the Elkartetippia multisociety backoffice.",
        "If you received it, SMTP settings on the server are valid.",
        "",
        `Sent at ${new Date().toISOString()}`,
      ].join("\n"),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to send test message.";
    throw new BackofficeMailTestError("SEND_FAILED", msg);
  }
}
