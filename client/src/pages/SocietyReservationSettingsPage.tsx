import { useState, useEffect, useMemo } from "react";
import {
  CalendarDays,
  Save,
  DollarSign,
  UtensilsCrossed,
  ClipboardList,
  Trash2,
  Map,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { Society, SocietyReservationMealType, ReservationService } from "@shared/schema";
import {
  normalizeSocietyReservationMealTypes,
  societyReservationMealTypesSchema,
  isBuiltinReservationServiceSlug,
  RESERVATION_SERVICE_SLUG_KITCHEN,
  BUILTIN_RESERVATION_SERVICE_KITCHEN_LABEL_EU,
  BUILTIN_RESERVATION_SERVICE_KITCHEN_LABEL_ES,
  allocateUniqueReservationMealTypeId,
} from "@shared/schema";
import { Permission } from "@shared/permissions";
import { useAuth, userCan } from "@/lib/auth";
import { ImageUpload } from "@/components/ImageUpload";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "@/components/ErrorBoundary";
import { ELKARTE_SOCIETY_PROFILE_UPDATED_EVENT } from "@/lib/society-events";
import { thumbFilenameFromImageUrl } from "@/lib/image-urls";
import { authFetch } from "@/lib/api";

function societyFromApiPayload(data: Society): Society {
  return {
    ...data,
    reservationMealTypes: normalizeSocietyReservationMealTypes(data.reservationMealTypes),
  };
}

export function SocietyReservationSettingsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [society, setSociety] = useState<Society | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reservationServicesList, setReservationServicesList] = useState<ReservationService[]>([]);
  const [reservationServicesLoading, setReservationServicesLoading] = useState(false);
  const [newServiceDraft, setNewServiceDraft] = useState({
    labelEu: "",
    labelEs: "",
    fixedPrice: "0",
    pricePerMember: "0",
  });

  useEffect(() => {
    const fetchSociety = async () => {
      try {
        const token = localStorage.getItem("auth:token");
        const response = await fetch("/api/societies/user", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = (await response.json()) as Society;
          setSociety(societyFromApiPayload(data));
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
    void fetchSociety();
  }, [toast]);

  useEffect(() => {
    if (!society?.id || !userCan(user, Permission.SOCIETY_MANAGE)) return;
    let cancelled = false;
    void (async () => {
      setReservationServicesLoading(true);
      try {
        const normalizeList = (raw: ReservationService[]): ReservationService[] => {
          const list = Array.isArray(raw) ? raw : [];
          return list.map(r =>
            r.slug === RESERVATION_SERVICE_SLUG_KITCHEN
              ? {
                  ...r,
                  labelEu: r.labelEu.trim() || BUILTIN_RESERVATION_SERVICE_KITCHEN_LABEL_EU,
                  labelEs: r.labelEs.trim() || BUILTIN_RESERVATION_SERVICE_KITCHEN_LABEL_ES,
                }
              : r
          );
        };

        const res = await authFetch("/api/reservation-services/sync-built-ins", {
          method: "POST",
          body: "{}",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ReservationService[];
        const list = normalizeList(Array.isArray(data) ? data : []);
        if (!cancelled) setReservationServicesList(list);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setReservationServicesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [society?.id, user]);

  /** Kitchen is always listed first (built-in row). */
  const reservationServicesTableRows = useMemo(() => {
    const rows = [...reservationServicesList];
    const ki = rows.findIndex(r => r.slug === RESERVATION_SERVICE_SLUG_KITCHEN);
    if (ki > 0) {
      const [k] = rows.splice(ki, 1);
      rows.unshift(k);
    }
    return rows;
  }, [reservationServicesList]);

  const patchLocalService = (id: string, patch: Partial<ReservationService>) => {
    setReservationServicesList(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleDeleteReservationService = async (row: ReservationService) => {
    if (isBuiltinReservationServiceSlug(row.slug)) return;
    try {
      const res = await authFetch(`/api/reservation-services/${row.id}`, { method: "DELETE" });
      if (res.status !== 204) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? t("error"));
      }
      setReservationServicesList(prev => prev.filter(s => s.id !== row.id));
      toast({ title: t("success"), description: t("reservationServiceDeleted") });
    } catch (e) {
      toast({
        title: t("error"),
        description: e instanceof Error ? e.message : t("error"),
        variant: "destructive",
      });
    }
  };

  const handleAddReservationService = async () => {
    if (!newServiceDraft.labelEu.trim() && !newServiceDraft.labelEs.trim()) {
      toast({
        title: t("error"),
        description: t("reservationServiceAddValidation"),
        variant: "destructive",
      });
      return;
    }
    try {
      const res = await authFetch("/api/reservation-services", {
        method: "POST",
        body: JSON.stringify({
          labelEu: newServiceDraft.labelEu.trim(),
          labelEs: newServiceDraft.labelEs.trim(),
          fixedPrice: newServiceDraft.fixedPrice,
          pricePerMember: newServiceDraft.pricePerMember,
          isActive: true,
          isDefault: false,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? t("error"));
      }
      const created = (await res.json()) as ReservationService;
      setReservationServicesList(prev =>
        [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder)
      );
      setNewServiceDraft({
        labelEu: "",
        labelEs: "",
        fixedPrice: "0",
        pricePerMember: "0",
      });
      toast({ title: t("success"), description: t("reservationServiceCreated") });
    } catch (e) {
      toast({
        title: t("error"),
        description: e instanceof Error ? e.message : t("error"),
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!society) return;

    const mealsDraft = society.reservationMealTypes ?? [];
    if (mealsDraft.length < 1) {
      toast({
        title: t("error"),
        description: t("reservationMealTypesNeedOne"),
        variant: "destructive",
      });
      return;
    }
    const parsedMeals = societyReservationMealTypesSchema.safeParse(mealsDraft);
    if (!parsedMeals.success) {
      toast({
        title: t("error"),
        description: t("reservationMealTypesInvalid"),
        variant: "destructive",
      });
      return;
    }

    let nextReservationServices = reservationServicesList;
    if (userCan(user, Permission.SOCIETY_MANAGE)) {
      for (const row of reservationServicesList) {
        if (!row.labelEu.trim() && !row.labelEs.trim()) {
          toast({
            title: t("error"),
            description: t("reservationServiceAddValidation"),
            variant: "destructive",
          });
          return;
        }
        try {
          const res = await authFetch(`/api/reservation-services/${row.id}`, {
            method: "PUT",
            body: JSON.stringify({
              labelEu: row.labelEu,
              labelEs: row.labelEs,
              fixedPrice: row.fixedPrice,
              pricePerMember: row.pricePerMember,
              isActive: row.isActive,
              isDefault: row.isDefault,
            }),
          });
          if (!res.ok) {
            const err = (await res.json()) as { message?: string };
            throw new Error(err.message ?? t("error"));
          }
          const updated = (await res.json()) as ReservationService;
          nextReservationServices = nextReservationServices.map(s =>
            s.id === updated.id ? updated : s
          );
        } catch (e) {
          toast({
            title: t("error"),
            description: e instanceof Error ? e.message : t("errorSavingSociety"),
            variant: "destructive",
          });
          return;
        }
      }
      setReservationServicesList(nextReservationServices);
    }

    const kitchenRow = nextReservationServices.find(
      s => s.slug === RESERVATION_SERVICE_SLUG_KITCHEN
    );
    const kitchenPriceForSociety = kitchenRow
      ? String(kitchenRow.pricePerMember ?? "")
      : society.kitchenPricePerMember;

    try {
      const token = localStorage.getItem("auth:token");
      const updateBody = {
        reservationFixedFee: society.reservationFixedFee ?? "0.00",
        reservationPricePerMember: society.reservationPricePerMember,
        kitchenPricePerMember: kitchenPriceForSociety,
        reservationMealTypes: parsedMeals.data,
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
        setSociety(societyFromApiPayload(raw));
        window.dispatchEvent(new Event(ELKARTE_SOCIETY_PROFILE_UPDATED_EVENT));
        toast({ title: t("success"), description: t("societyUpdated") });
      } else {
        throw new Error("Failed to save society");
      }
    } catch (error) {
      console.error("Error saving reservation settings:", error);
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

  const reservationMealTypesRows = society.reservationMealTypes ?? [];
  const canManageSocietyImages = userCan(user, Permission.SOCIETY_MANAGE);

  const updateReservationMealTypeLabels = (
    index: number,
    field: "labelEu" | "labelEs",
    value: string
  ) => {
    const next = reservationMealTypesRows.map((r, i) =>
      i === index ? { ...r, [field]: value } : r
    );
    const row = next[index];
    next[index] = {
      ...row,
      id: allocateUniqueReservationMealTypeId(next, index, row.labelEu, row.labelEs),
    };
    setSociety({ ...society, reservationMealTypes: next });
  };

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-6xl mx-auto w-full">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-7 w-7" />
            {t("societyReservationSettings")}
          </h2>
          <p className="text-muted-foreground">{t("societyReservationSettingsHelp")}</p>
        </div>

        <div className="space-y-6">
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
                  <Label>{t("reservationFixedFee")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={String(society.reservationFixedFee ?? "")}
                    onChange={e => setSociety({ ...society, reservationFixedFee: e.target.value })}
                    data-testid="input-reservation-fixed-fee"
                  />
                  <p className="text-xs text-muted-foreground">{t("reservationFixedFeeHint")}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t("reservationPricePerMember")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={society.reservationPricePerMember ?? ""}
                    onChange={e =>
                      setSociety({ ...society, reservationPricePerMember: e.target.value })
                    }
                    data-testid="input-reservation-price-per-member"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {canManageSocietyImages ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Map className="h-5 w-5" />
                  {t("societyFloorPlanCardTitle")}
                </CardTitle>
                <CardDescription>{t("societyFloorPlanCardDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                <ImageUpload
                  societyId={society.id}
                  entity="society-map"
                  entityId={society.id}
                  label={t("societyMapLabel")}
                  description={t("societyMapUploadHint")}
                  currentFilename={society.mapImageUrl}
                  thumbFilename={thumbFilenameFromImageUrl(society.mapImageUrl)}
                  disabled={!user}
                  onUploaded={filename => {
                    setSociety({ ...society, mapImageUrl: filename });
                    window.dispatchEvent(new Event(ELKARTE_SOCIETY_PROFILE_UPDATED_EVENT));
                  }}
                  onRemoved={() => {
                    setSociety({ ...society, mapImageUrl: null });
                    window.dispatchEvent(new Event(ELKARTE_SOCIETY_PROFILE_UPDATED_EVENT));
                  }}
                />
              </CardContent>
            </Card>
          ) : null}

          {canManageSocietyImages ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  {t("reservationServices")}
                </CardTitle>
                <CardDescription>{t("reservationServicesDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {reservationServicesLoading ? (
                  <p className="text-sm text-muted-foreground">{t("loading")}…</p>
                ) : reservationServicesList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noServicesConfigured")}</p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <div className="min-w-[44rem] divide-y">
                      <div className="grid grid-cols-12 gap-2 p-2 text-xs font-medium text-muted-foreground bg-muted/40 items-end">
                        <div className="col-span-3">{t("serviceLabelEu")}</div>
                        <div className="col-span-3">{t("serviceLabelEs")}</div>
                        <div className="col-span-1">{t("serviceFixedPrice")}</div>
                        <div className="col-span-1">{t("servicePricePerMember")}</div>
                        <div className="col-span-1 text-center">{t("serviceIsActive")}</div>
                        <div className="col-span-1 text-center">{t("serviceIsDefault")}</div>
                        <div className="col-span-2" />
                      </div>
                      {reservationServicesTableRows.map(row => (
                        <div
                          key={row.id}
                          className="grid grid-cols-12 gap-2 p-2 items-center text-sm"
                        >
                          <div className="col-span-3">
                            <Input
                              className="h-9"
                              value={row.labelEu}
                              onChange={e => patchLocalService(row.id, { labelEu: e.target.value })}
                            />
                          </div>
                          <div className="col-span-3">
                            <Input
                              className="h-9"
                              value={row.labelEs}
                              onChange={e => patchLocalService(row.id, { labelEs: e.target.value })}
                            />
                          </div>
                          <div className="col-span-1">
                            <Input
                              className="h-9"
                              inputMode="decimal"
                              value={row.fixedPrice}
                              onChange={e =>
                                patchLocalService(row.id, { fixedPrice: e.target.value })
                              }
                            />
                          </div>
                          <div className="col-span-1">
                            <Input
                              className="h-9"
                              inputMode="decimal"
                              value={row.pricePerMember}
                              onChange={e =>
                                patchLocalService(row.id, { pricePerMember: e.target.value })
                              }
                            />
                          </div>
                          <div className="col-span-1 flex justify-center">
                            <Checkbox
                              checked={row.isActive}
                              onCheckedChange={c =>
                                patchLocalService(row.id, { isActive: c === true })
                              }
                            />
                          </div>
                          <div className="col-span-1 flex justify-center">
                            <Checkbox
                              checked={row.isDefault}
                              onCheckedChange={c =>
                                patchLocalService(row.id, { isDefault: c === true })
                              }
                            />
                          </div>
                          <div className="col-span-2 flex justify-end">
                            {!isBuiltinReservationServiceSlug(row.slug) ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                                aria-label={t("delete")}
                                onClick={() => void handleDeleteReservationService(row)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-md border p-3 space-y-3">
                  <p className="text-sm font-medium">{t("addService")}</p>
                  <div className="overflow-x-auto">
                    <div className="flex min-w-[44rem] flex-nowrap items-end gap-2">
                      <div className="min-w-0 flex-[3] space-y-1">
                        <Label className="text-xs">{t("serviceLabelEu")}</Label>
                        <Input
                          className="h-9"
                          value={newServiceDraft.labelEu}
                          onChange={e =>
                            setNewServiceDraft(d => ({ ...d, labelEu: e.target.value }))
                          }
                        />
                      </div>
                      <div className="min-w-0 flex-[3] space-y-1">
                        <Label className="text-xs">{t("serviceLabelEs")}</Label>
                        <Input
                          className="h-9"
                          value={newServiceDraft.labelEs}
                          onChange={e =>
                            setNewServiceDraft(d => ({ ...d, labelEs: e.target.value }))
                          }
                        />
                      </div>
                      <div className="w-[5.5rem] shrink-0 space-y-1">
                        <Label className="text-xs whitespace-nowrap">
                          {t("serviceFixedPrice")}
                        </Label>
                        <Input
                          className="h-9"
                          inputMode="decimal"
                          value={newServiceDraft.fixedPrice}
                          onChange={e =>
                            setNewServiceDraft(d => ({ ...d, fixedPrice: e.target.value }))
                          }
                        />
                      </div>
                      <div className="w-[5.5rem] shrink-0 space-y-1">
                        <Label className="text-xs whitespace-nowrap">
                          {t("servicePricePerMember")}
                        </Label>
                        <Input
                          className="h-9"
                          inputMode="decimal"
                          value={newServiceDraft.pricePerMember}
                          onChange={e =>
                            setNewServiceDraft(d => ({ ...d, pricePerMember: e.target.value }))
                          }
                        />
                      </div>
                      <div className="shrink-0 pb-px">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 whitespace-nowrap"
                          onClick={() => void handleAddReservationService()}
                        >
                          {t("addService")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5" />
                {t("reservationMealTypesTitle")}
              </CardTitle>
              <CardDescription>{t("reservationMealTypesDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border overflow-x-auto">
                <div className="min-w-[28rem] divide-y">
                  <div className="grid grid-cols-12 gap-2 p-2 text-xs font-medium text-muted-foreground bg-muted/40">
                    <div className="col-span-5">{t("reservationMealTypeLabelEu")}</div>
                    <div className="col-span-5">{t("reservationMealTypeLabelEs")}</div>
                    <div className="col-span-2 text-right" />
                  </div>
                  {reservationMealTypesRows.map((row, index) => (
                    <div
                      key={`meal-row-${index}`}
                      className="grid grid-cols-12 gap-2 p-2 items-center"
                    >
                      <div className="col-span-5">
                        <Input
                          className="h-9"
                          value={row.labelEu}
                          onChange={e =>
                            updateReservationMealTypeLabels(index, "labelEu", e.target.value)
                          }
                          data-testid={`input-reservation-meal-labeu-${index}`}
                        />
                      </div>
                      <div className="col-span-5">
                        <Input
                          className="h-9"
                          value={row.labelEs}
                          onChange={e =>
                            updateReservationMealTypeLabels(index, "labelEs", e.target.value)
                          }
                          data-testid={`input-reservation-meal-labes-${index}`}
                        />
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                          aria-label={t("reservationMealTypeRemove")}
                          disabled={reservationMealTypesRows.length <= 1}
                          onClick={() => {
                            if (reservationMealTypesRows.length <= 1) return;
                            setSociety({
                              ...society,
                              reservationMealTypes: reservationMealTypesRows.filter(
                                (_, i) => i !== index
                              ),
                            });
                          }}
                          data-testid={`button-remove-reservation-meal-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = [
                    ...reservationMealTypesRows,
                    { id: "", labelEu: "", labelEs: "" } satisfies SocietyReservationMealType,
                  ];
                  const idx = next.length - 1;
                  next[idx] = {
                    ...next[idx],
                    id: allocateUniqueReservationMealTypeId(next, idx, "", ""),
                  };
                  setSociety({ ...society, reservationMealTypes: next });
                }}
                data-testid="button-add-reservation-meal"
              >
                {t("reservationMealTypeAdd")}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => void handleSave()} data-testid="button-save-reservation-settings">
            <Save className="mr-2 h-4 w-4" />
            {t("save")}
          </Button>
        </div>
      </div>
    </ErrorBoundary>
  );
}
