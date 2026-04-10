import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/i18n";
import { authFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, Send, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type EmailStatus = {
  emailEnabled: boolean;
  smtpHostSet: boolean;
  mailFromSet: boolean;
  smtpAuthSet: boolean;
  mailLogToStdout: boolean;
  readyForSmtp: boolean;
};

function FlagRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <Check className="h-4 w-4 text-green-600 shrink-0" aria-hidden />
      ) : (
        <X className="h-4 w-4 text-destructive shrink-0" aria-hidden />
      )}
      <span>{label}</span>
    </div>
  );
}

export function BackofficeEmailPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [recipient, setRecipient] = useState("");
  const [sending, setSending] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/backoffice/email/status");
      if (!res.ok) throw new Error("status");
      const data = (await res.json()) as EmailStatus;
      setStatus(data);
    } catch {
      toast({
        title: t("error"),
        description: t("backofficeEmailTestFailed"),
        variant: "destructive",
      });
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const handleSendTest = async () => {
    const to = recipient.trim();
    if (!to) {
      toast({
        title: t("error"),
        description: t("superadminEmailRequired"),
        variant: "destructive",
      });
      return;
    }
    setSending(true);
    try {
      const res = await authFetch("/api/backoffice/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data.message === "string" ? data.message : t("backofficeEmailTestFailed");
        throw new Error(msg);
      }
      toast({
        title: t("success"),
        description: t("backofficeEmailTestSuccess"),
      });
    } catch (e: unknown) {
      toast({
        title: t("backofficeEmailTestFailed"),
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const canSend =
    status?.readyForSmtp === true && status.emailEnabled === true && recipient.trim().length > 0;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">{t("backofficeEmailPageTitle")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("backofficeEmailPageDescription")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("backofficeEmailStatusHeading")}</CardTitle>
          <CardDescription>
            {status?.readyForSmtp && status.emailEnabled
              ? t("backofficeEmailReady")
              : t("backofficeEmailNotReady")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading || !status ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <>
              <FlagRow ok={status.emailEnabled} label={t("backofficeEmailFlagEnabled")} />
              <FlagRow ok={status.smtpHostSet} label={t("backofficeEmailFlagSmtpHost")} />
              <FlagRow ok={status.mailFromSet} label={t("backofficeEmailFlagMailFrom")} />
              <FlagRow ok={status.smtpAuthSet} label={t("backofficeEmailFlagAuth")} />
              <FlagRow ok={status.mailLogToStdout} label={t("backofficeEmailFlagLogStdout")} />
            </>
          )}
        </CardContent>
      </Card>

      {status?.mailLogToStdout ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("backofficeEmailFlagLogStdout")}</AlertTitle>
          <AlertDescription>{t("backofficeEmailLogStdoutWarning")}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("backofficeEmailTestHeading")}</CardTitle>
          <CardDescription>{t("backofficeEmailTestHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="backoffice-email-to">{t("email")}</Label>
            <Input
              id="backoffice-email-to"
              type="email"
              value={recipient}
              onChange={e => setRecipient(e.target.value)}
              placeholder={t("backofficeEmailRecipientPlaceholder")}
              data-testid="backoffice-email-recipient"
            />
          </div>
          <Button
            onClick={() => void handleSendTest()}
            disabled={!canSend || sending || loading}
            className="gap-2"
            data-testid="backoffice-email-send-test"
          >
            <Send className="h-4 w-4" />
            {sending ? t("saving") : t("backofficeEmailSendTest")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
