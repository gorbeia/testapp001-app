import { Link } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { usePrepaymentLedgerStatus } from "@/hooks/usePrepaymentLedgerStatus";
import { AlertTriangle } from "lucide-react";

export function PrepaymentLedgerBanner() {
  const { t } = useLanguage();
  const { data } = usePrepaymentLedgerStatus();

  if (!data?.enforced || !data.belowFloor) {
    return null;
  }

  return (
    <Alert
      variant="destructive"
      className="rounded-none border-x-0 border-t-0 shrink-0"
      data-testid="banner-prepayment-ledger-floor"
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{t("prepaymentLedgerBannerTitle")}</AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2">
        <span className="text-sm">{t("prepaymentLedgerBannerDescription")}</span>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href="/nire-mugimenduak">{t("prepaymentLedgerBannerLinkMovements")}</Link>
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/transferentziak">{t("prepaymentLedgerBannerLinkPrepayment")}</Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
