export type { MailPayload, MailTransport } from "./types";
export { getMailTransport, setMailTransportForTests, logMailPreviewIfRequested } from "./transport";
export { sendRawEmail } from "./send-raw";
export {
  sendUserNotificationEmail,
  queueUserNotificationEmail,
  resolveNotificationEmailContent,
} from "./notification-email";
export { getOutboundEmailConfigSnapshot, type OutboundEmailConfigSnapshot } from "./smtp-env";
export {
  verifyAndSendBackofficeTestEmail,
  BackofficeMailTestError,
  type BackofficeMailTestErrorCode,
} from "./smtp-test";
