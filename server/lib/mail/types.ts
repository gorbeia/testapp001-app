export interface MailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface MailTransport {
  send(payload: MailPayload): Promise<void>;
}
