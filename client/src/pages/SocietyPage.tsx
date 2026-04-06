import { useState, useEffect, useRef } from "react";
import { Building2, Save, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { SepaMode, SocietyPaymentMethod } from "@shared/schema";
import { normalizeSocietyPaymentMethods } from "@shared/schema";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "@/components/ErrorBoundary";

const SEPA_CADENCE_MODES = ["monthly", "bimonthly", "quarterly", "on_demand"] as const;
type SepaCadenceMode = (typeof SEPA_CADENCE_MODES)[number];

interface Society {
  id: string;
  name: string;
  iban: string;
  creditorId: string;
  address: string;
  phone: string;
  email: string;
  reservationPricePerMember: string;
  kitchenPricePerMember: string;
  sepaMode?: SepaMode | string;
  paymentMethods?: SocietyPaymentMethod[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  const [society, setSociety] = useState<Society | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastSepaCadenceRef = useRef<SepaCadenceMode>("monthly");

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
          const normalized: Society = {
            ...data,
            paymentMethods: normalizeSocietyPaymentMethods(data.paymentMethods),
          };
          setSociety(normalized);
          if (normalized.sepaMode && normalized.sepaMode !== "disabled") {
            lastSepaCadenceRef.current = normalized.sepaMode as SepaCadenceMode;
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

    try {
      const token = localStorage.getItem("auth:token");
      const updateBody = {
        name: society.name,
        iban: society.iban,
        creditorId: society.creditorId,
        address: society.address,
        phone: society.phone,
        email: society.email,
        reservationPricePerMember: society.reservationPricePerMember,
        kitchenPricePerMember: society.kitchenPricePerMember,
        sepaMode: society.sepaMode ?? "monthly",
        paymentMethods: normalizeSocietyPaymentMethods(society.paymentMethods),
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
        const savedSociety: Society = {
          ...raw,
          paymentMethods: normalizeSocietyPaymentMethods(raw.paymentMethods),
        };
        setSociety(savedSociety);
        if (savedSociety.sepaMode && savedSociety.sepaMode !== "disabled") {
          lastSepaCadenceRef.current = savedSociety.sepaMode as SepaCadenceMode;
        }
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
  const sepaEnabled = (society.sepaMode ?? "monthly") !== "disabled";
  const sepaCadenceValue: SepaCadenceMode = sepaEnabled
    ? SEPA_CADENCE_MODES.includes(society.sepaMode as SepaCadenceMode)
      ? (society.sepaMode as SepaCadenceMode)
      : "monthly"
    : lastSepaCadenceRef.current;

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div>
          <h2 className="text-2xl font-bold">{t("society")}</h2>
          <p className="text-muted-foreground">{t("societyDataAndSepaConfig")}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
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
                  onChange={e => setSociety({ ...society, name: e.target.value })}
                  data-testid="input-society-name"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("address")}</Label>
                <Input
                  value={society.address}
                  onChange={e => setSociety({ ...society, address: e.target.value })}
                  data-testid="input-society-address"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("phone")}</Label>
                  <Input
                    value={society.phone}
                    onChange={e => setSociety({ ...society, phone: e.target.value })}
                    data-testid="input-society-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("email")}</Label>
                  <Input
                    type="email"
                    value={society.email}
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
                <Building2 className="h-5 w-5" />
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
                        value={society.iban}
                        onChange={e => setSociety({ ...society, iban: e.target.value })}
                        placeholder="ES00 0000 0000 0000 0000 0000"
                        data-testid="input-society-iban"
                      />
                      <p className="text-xs text-muted-foreground">{t("accountForReceivingPayments")}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("creditorId")}</Label>
                      <Input
                        value={society.creditorId}
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

                {(
                  [
                    ["bank_transfer_prepayment", "paymentMethodBankTransferPrepayment"] as const,
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                {t("reservationPricing")}
              </CardTitle>
              <CardDescription>{t("setReservationPrices")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("reservationPricePerMember")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={society.reservationPricePerMember}
                    onChange={e =>
                      setSociety({ ...society, reservationPricePerMember: e.target.value })
                    }
                    data-testid="input-reservation-price-per-member"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("kitchenPricePerMember")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={society.kitchenPricePerMember}
                    onChange={e =>
                      setSociety({ ...society, kitchenPricePerMember: e.target.value })
                    }
                    data-testid="input-kitchen-price-per-member"
                  />
                </div>
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
