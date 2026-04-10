import { useState, useEffect, useRef } from "react";
import { Building2, CreditCard, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SepaMode, SocietyPaymentMethod, Society } from "@shared/schema";
import { normalizeSocietyPaymentMethods } from "@shared/schema";
import { deriveSocietyAcronym } from "@shared/society-acronym";
import { Permission } from "@shared/permissions";
import { useAuth, userCan } from "@/lib/auth";
import { ImageUpload } from "@/components/ImageUpload";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "@/components/ErrorBoundary";
import { ELKARTE_SOCIETY_PROFILE_UPDATED_EVENT } from "@/lib/society-events";
import { thumbFilenameFromImageUrl } from "@/lib/image-urls";

const SEPA_CADENCE_MODES = ["monthly", "bimonthly", "quarterly", "on_demand"] as const;
type SepaCadenceMode = (typeof SEPA_CADENCE_MODES)[number];

const ACRONYM_LETTERS_RE = /^[A-Za-z\xC0-\xFF\u0100-\u017F\u0180-\u024F]+$/;
const ACRONYM_INPUT_FILTER = /[^A-Za-z\xC0-\xFF\u0100-\u017F\u0180-\u024F]/g;

function isAcronymCustomized(name: string, storedAcronym: string): boolean {
  const derived = deriveSocietyAcronym(name);
  const stored = storedAcronym.trim();
  if (!stored) return false;
  return stored.toUpperCase() !== derived.toUpperCase();
}

function societyFromApiPayload(data: Society): Society {
  const derived = deriveSocietyAcronym(data.name);
  const stored = (data.acronym ?? "").trim();
  const acronym = stored || derived;
  return {
    ...data,
    acronym,
    shortDescription: data.shortDescription ?? "",
  };
}

function togglePaymentMethod(
  current: SocietyPaymentMethod[] | null | undefined,
  method: SocietyPaymentMethod,
  checked: boolean
): SocietyPaymentMethod[] {
  const set = new Set(normalizeSocietyPaymentMethods(current));
  if (checked) set.add(method);
  else set.delete(method);
  return Array.from(set);
}

export function SocietyPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [society, setSociety] = useState<Society | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastSepaCadenceRef = useRef<SepaCadenceMode>("monthly");
  const acronymCustomizedRef = useRef(false);
  // Load current society from API
  useEffect(() => {
    const fetchSociety = async () => {
      try {
        const token = localStorage.getItem("auth:token");

        const response = await fetch("/api/societies/user", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = (await response.json()) as Society;
          const withMeta = societyFromApiPayload({
            ...data,
            paymentMethods: normalizeSocietyPaymentMethods(data.paymentMethods),
          });
          acronymCustomizedRef.current = isAcronymCustomized(data.name, data.acronym ?? "");
          setSociety(withMeta);
          if (withMeta.sepaMode && withMeta.sepaMode !== "disabled") {
            lastSepaCadenceRef.current = withMeta.sepaMode as SepaCadenceMode;
          }
        } else {
          const errorText = await response.text();
          console.error("API error:", response.status, errorText);
        }
      } catch (error) {
        console.error("Error fetching society:", error);
        toast({
          title: "Error",
          description: "Failed to load society data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSociety();
  }, [toast]);

  const handleSave = async () => {
    if (!society) return;

    const nameTrim = society.name.trim();
    const derivedAcronym = deriveSocietyAcronym(nameTrim);
    const acronymForSave = acronymCustomizedRef.current
      ? (society.acronym ?? "").trim().toUpperCase()
      : derivedAcronym;

    if (!nameTrim) {
      toast({
        title: t("error"),
        description: t("societyNameRequired"),
        variant: "destructive",
      });
      return;
    }

    if (!acronymForSave || acronymForSave.length < 1 || acronymForSave.length > 3) {
      toast({
        title: t("error"),
        description: t("societyAcronymRequired"),
        variant: "destructive",
      });
      return;
    }

    if (!ACRONYM_LETTERS_RE.test(acronymForSave)) {
      toast({
        title: t("error"),
        description: t("societyAcronymInvalid"),
        variant: "destructive",
      });
      return;
    }

    try {
      const token = localStorage.getItem("auth:token");
      const sd = society.shortDescription?.trim() ?? "";
      const updateBody = {
        name: nameTrim,
        shortDescription: sd === "" ? null : sd.slice(0, 500),
        acronym: acronymForSave,
        iban: society.iban,
        creditorId: society.creditorId,
        address: society.address,
        phone: society.phone,
        email: society.email,
        sepaMode: society.sepaMode ?? "monthly",
        paymentMethods: normalizeSocietyPaymentMethods(society.paymentMethods),
        prepaymentMinLedgerBalance:
          society.prepaymentMinLedgerBalance === undefined ||
          society.prepaymentMinLedgerBalance === null ||
          String(society.prepaymentMinLedgerBalance).trim() === ""
            ? null
            : String(society.prepaymentMinLedgerBalance),
      };

      const response = await fetch(`/api/societies/${society.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateBody),
      });

      if (response.ok) {
        const raw = (await response.json()) as Society;
        const savedSociety = societyFromApiPayload({
          ...raw,
          paymentMethods: normalizeSocietyPaymentMethods(raw.paymentMethods),
        });
        acronymCustomizedRef.current = isAcronymCustomized(raw.name, raw.acronym ?? "");
        setSociety(savedSociety);
        if (savedSociety.sepaMode && savedSociety.sepaMode !== "disabled") {
          lastSepaCadenceRef.current = savedSociety.sepaMode as SepaCadenceMode;
        }
        window.dispatchEvent(new Event(ELKARTE_SOCIETY_PROFILE_UPDATED_EVENT));
        toast({
          title: t("success"),
          description: t("societyUpdated"),
        });
      } else {
        throw new Error("Failed to save society");
      }
    } catch (error) {
      console.error("Error saving society:", error);
      toast({
        title: t("error"),
        description: t("errorSavingSociety"),
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <div>{t("loading")}</div>;
  }

  if (!society) {
    return <div>{t("noSocietyData")}</div>;
  }

  const paymentMethods = normalizeSocietyPaymentMethods(society.paymentMethods);
  const canManageSocietyImages = userCan(user, Permission.SOCIETY_MANAGE);
  const prepaymentEnabled = paymentMethods.includes("bank_transfer_prepayment");
  const sepaEnabled = (society.sepaMode ?? "monthly") !== "disabled";
  const sepaCadenceValue: SepaCadenceMode = sepaEnabled
    ? SEPA_CADENCE_MODES.includes(society.sepaMode as SepaCadenceMode)
      ? (society.sepaMode as SepaCadenceMode)
      : "monthly"
    : lastSepaCadenceRef.current;

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-6xl mx-auto w-full">
        <div>
          <h2 className="text-2xl font-bold">{t("society")}</h2>
          <p className="text-muted-foreground">{t("societyPageSubtitleContact")}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {t("societyData")}
              </CardTitle>
              <CardDescription>{t("societyBasicInfo")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("societyName")}</Label>
                <Input
                  value={society.name}
                  onChange={e => {
                    const name = e.target.value;
                    const next: Society = { ...society, name };
                    if (!acronymCustomizedRef.current) {
                      next.acronym = deriveSocietyAcronym(name);
                    }
                    setSociety(next);
                  }}
                  data-testid="input-society-name"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("societyAcronym")}</Label>
                <Input
                  value={society.acronym ?? ""}
                  maxLength={3}
                  className="uppercase"
                  placeholder={deriveSocietyAcronym(society.name)}
                  onChange={e => {
                    acronymCustomizedRef.current = true;
                    const v = e.target.value
                      .toUpperCase()
                      .slice(0, 3)
                      .replace(ACRONYM_INPUT_FILTER, "");
                    setSociety({ ...society, acronym: v });
                  }}
                  onBlur={() => {
                    const d = deriveSocietyAcronym(society.name);
                    const cur = (society.acronym ?? "").trim().toUpperCase();
                    if (cur === d.toUpperCase()) {
                      acronymCustomizedRef.current = false;
                    }
                  }}
                  data-testid="input-society-acronym"
                />
                <p className="text-xs text-muted-foreground">{t("societyAcronymHint")}</p>
              </div>
              <div className="space-y-2">
                <Label>{t("societyShortDescription")}</Label>
                <Textarea
                  value={society.shortDescription ?? ""}
                  onChange={e =>
                    setSociety({ ...society, shortDescription: e.target.value.slice(0, 500) })
                  }
                  maxLength={500}
                  rows={3}
                  data-testid="input-society-short-description"
                />
                <p className="text-xs text-muted-foreground">{t("societyShortDescriptionHint")}</p>
              </div>
              {canManageSocietyImages ? (
                <div className="space-y-6 pt-2 border-t">
                  <ImageUpload
                    societyId={society.id}
                    entity="society-logo"
                    entityId={society.id}
                    label={t("societyLogoLabel")}
                    description={t("societyLogoHint")}
                    currentFilename={society.logoUrl}
                    thumbFilename={thumbFilenameFromImageUrl(society.logoUrl)}
                    disabled={!user}
                    onUploaded={filename => {
                      setSociety({ ...society, logoUrl: filename });
                      window.dispatchEvent(new Event(ELKARTE_SOCIETY_PROFILE_UPDATED_EVENT));
                    }}
                    onRemoved={() => {
                      setSociety({ ...society, logoUrl: null });
                      window.dispatchEvent(new Event(ELKARTE_SOCIETY_PROFILE_UPDATED_EVENT));
                    }}
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>{t("address")}</Label>
                <Input
                  value={society.address ?? ""}
                  onChange={e => setSociety({ ...society, address: e.target.value })}
                  data-testid="input-society-address"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("phone")}</Label>
                  <Input
                    value={society.phone ?? ""}
                    onChange={e => setSociety({ ...society, phone: e.target.value })}
                    data-testid="input-society-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("email")}</Label>
                  <Input
                    type="email"
                    value={society.email ?? ""}
                    onChange={e => setSociety({ ...society, email: e.target.value })}
                    data-testid="input-society-email"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-payment-methods">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {t("societyPaymentMethodsCardTitle")}
              </CardTitle>
              <CardDescription>{t("societyPaymentMethodsCardDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium">{t("societyAcceptedPaymentMethods")}</p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="pm-sepa"
                    checked={sepaEnabled}
                    data-testid="checkbox-payment-sepa"
                    onCheckedChange={checked => {
                      const on = checked === true;
                      if (on) {
                        setSociety({
                          ...society,
                          sepaMode: lastSepaCadenceRef.current,
                        });
                      } else {
                        if (society.sepaMode && society.sepaMode !== "disabled") {
                          lastSepaCadenceRef.current = society.sepaMode as SepaCadenceMode;
                        }
                        setSociety({ ...society, sepaMode: "disabled" });
                      }
                    }}
                  />
                  <Label htmlFor="pm-sepa" className="font-normal cursor-pointer">
                    {t("paymentMethodSepa")}
                  </Label>
                </div>
                {sepaEnabled ? (
                  <div className="space-y-4 pl-6">
                    <div className="space-y-2">
                      <Label>{t("sepaCadenceLabel")}</Label>
                      <Select
                        value={sepaCadenceValue}
                        onValueChange={(value: SepaCadenceMode) => {
                          lastSepaCadenceRef.current = value;
                          setSociety({ ...society, sepaMode: value });
                        }}
                      >
                        <SelectTrigger data-testid="select-sepa-mode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">{t("sepaModeMonthly")}</SelectItem>
                          <SelectItem value="bimonthly">{t("sepaModeBimonthly")}</SelectItem>
                          <SelectItem value="quarterly">{t("sepaModeQuarterly")}</SelectItem>
                          <SelectItem value="on_demand">{t("sepaModeOnDemand")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">{t("sepaCadenceDescription")}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("societyIban")}</Label>
                      <Input
                        value={society.iban ?? ""}
                        onChange={e => setSociety({ ...society, iban: e.target.value })}
                        placeholder="ES00 0000 0000 0000 0000 0000"
                        data-testid="input-society-iban"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("accountForReceivingPayments")}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("creditorId")}</Label>
                      <Input
                        value={society.creditorId ?? ""}
                        onChange={e => setSociety({ ...society, creditorId: e.target.value })}
                        placeholder="ES00000X00000000"
                        data-testid="input-creditor-id"
                      />
                      <p className="text-xs text-muted-foreground">{t("sepaCreditorIdentifier")}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-amber-700 dark:text-amber-500 pl-0">
                    {t("sepaModeDisabledHint")}
                  </p>
                )}

                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Checkbox
                        id="pm-bank_transfer_prepayment"
                        data-testid="checkbox-payment-bank_transfer_prepayment"
                        checked={paymentMethods.includes("bank_transfer_prepayment")}
                        onCheckedChange={checked =>
                          setSociety({
                            ...society,
                            paymentMethods: togglePaymentMethod(
                              society.paymentMethods,
                              "bank_transfer_prepayment",
                              checked === true
                            ),
                          })
                        }
                      />
                      <Label
                        htmlFor="pm-bank_transfer_prepayment"
                        className="font-normal cursor-pointer whitespace-normal"
                      >
                        {t("paymentMethodBankTransferPrepayment")}
                      </Label>
                    </div>
                    {prepaymentEnabled ? (
                      <div className="flex flex-col gap-1 min-w-[10rem] max-w-xs flex-1 basis-[12rem]">
                        <Label htmlFor="prepayment-min-balance" className="sr-only">
                          {t("prepaymentMinLedgerBalanceLabel")}
                        </Label>
                        <Input
                          id="prepayment-min-balance"
                          type="text"
                          inputMode="decimal"
                          placeholder={t("prepaymentMinLedgerBalancePlaceholder")}
                          aria-label={t("prepaymentMinLedgerBalanceLabel")}
                          value={
                            society.prepaymentMinLedgerBalance === null ||
                            society.prepaymentMinLedgerBalance === undefined
                              ? ""
                              : String(society.prepaymentMinLedgerBalance)
                          }
                          onChange={e =>
                            setSociety({
                              ...society,
                              prepaymentMinLedgerBalance:
                                e.target.value === "" ? null : e.target.value,
                            })
                          }
                          data-testid="input-prepayment-min-ledger-balance"
                          className="h-9"
                        />
                      </div>
                    ) : null}
                  </div>
                  {prepaymentEnabled ? (
                    <p className="text-xs text-muted-foreground pl-6 max-w-lg">
                      {t("prepaymentMinLedgerBalanceHelp")}
                    </p>
                  ) : null}
                </div>

                {(
                  [
                    ["cash_manual", "paymentMethodCashManual"] as const,
                    ["cash_change_machine", "paymentMethodCashMachine"] as const,
                  ] as const
                ).map(([method, labelKey]) => (
                  <div key={method} className="flex items-center gap-2">
                    <Checkbox
                      id={`pm-${method}`}
                      data-testid={`checkbox-payment-${method}`}
                      checked={paymentMethods.includes(method)}
                      onCheckedChange={checked =>
                        setSociety({
                          ...society,
                          paymentMethods: togglePaymentMethod(
                            society.paymentMethods,
                            method,
                            checked === true
                          ),
                        })
                      }
                    />
                    <Label htmlFor={`pm-${method}`} className="font-normal cursor-pointer">
                      {t(labelKey)}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} data-testid="button-save-society">
            <Save className="mr-2 h-4 w-4" />
            {t("save")}
          </Button>
        </div>
      </div>
    </ErrorBoundary>
  );
}
