export interface MailPayload {
  to: string;
  subject: string;
  text: string;
  /** Display name in From header; falls back to `MAIL_FROM_NAME` env, then address only. */
  fromName?: string | null;
  html?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface MailTransport {
  send(payload: MailPayload): Promise<void>;
}
