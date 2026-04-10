import { getMailTransport, logMailPreviewIfRequested } from "./transport";
import type { MailPayload } from "./types";

/** Generic outbound mail (password reset, broadcasts, etc.). */
export async function sendRawEmail(payload: MailPayload): Promise<void> {
  logMailPreviewIfRequested(payload);
  await getMailTransport().send(payload);
}
