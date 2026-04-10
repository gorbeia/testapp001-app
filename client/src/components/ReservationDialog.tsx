import { useState, useEffect, useMemo } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { usePrepaymentLedgerStatus } from "@/hooks/usePrepaymentLedgerStatus";
import { useLanguage } from "@/lib/i18n";
import { dateFnsLocale } from "@/lib/date-locale";
import { format } from "date-fns";
import type { Society, SocietyEvent, Table, ReservationService } from "@shared/schema";
import {
  DEFAULT_RESERVATION_MEAL_TYPES,
  getReservationMealTypeLabel,
  normalizeSocietyReservationMealTypes,
  RESERVATION_SERVICE_SLUG_KITCHEN,
  computeReservationServiceLineTotal,
  reservationServiceDisplayLabel,
} from "@shared/schema";
import { startOfDay, endOfDay } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { societyMapSrc } from "@/lib/image-urls";

interface ReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** When set while the dialog opens, prefills the reservation date/time (e.g. from a calendar day). */
  defaultStartDate?: Date | null;
}

type TableWithOccupancy = Table & {
  bookedSeats?: number;
  seatsRemaining?: number;
};

interface FormData {
  type: string;
  startDate: Date;
  guests: number;
  table: string;
  notes: string;
}

const authFetch = async (url: string, options: globalThis.RequestInit = {}) => {
  const token = localStorage.getItem("auth:token");
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  return fetch(url, { ...options, headers });
};

function isTableSuitableForGuests(table: TableWithOccupancy, guests: number): boolean {
  const minC = table.minCapacity ?? 1;
  const maxC = table.maxCapacity;
  if (guests < minC || guests > maxC) return false;
  const rem = table.seatsRemaining;
  if (rem !== undefined && rem !== null) {
    if (guests > rem) return false;
    if (rem < minC) return false;
  }
  return true;
}

export function ReservationDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultStartDate,
}: ReservationDialogProps) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { data: ledgerStatus } = usePrepaymentLedgerStatus();
  const prepaymentBlocks = Boolean(ledgerStatus?.enforced && ledgerStatus?.belowFloor);
  const [society, setSociety] = useState<Society | null>(null);
  const [tables, setTables] = useState<TableWithOccupancy[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [calendarBlockNotes, setCalendarBlockNotes] = useState<string[]>([]);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [addonServices, setAddonServices] = useState<ReservationService[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState<FormData>({
    type: DEFAULT_RESERVATION_MEAL_TYPES[0].id,
    startDate: new Date(),
    guests: 10,
    table: "",
    notes: "",
  });

  const mealTypes = useMemo(
    () =>
      society
        ? normalizeSocietyReservationMealTypes(society.reservationMealTypes)
        : DEFAULT_RESERVATION_MEAL_TYPES,
    [society]
  );

  const baseReservationTotal = (guests: number) => {
    if (!society) return 0;
    const fixed = parseFloat(String(society.reservationFixedFee ?? "0")) || 0;
    const reservationPrice = parseFloat(society.reservationPricePerMember ?? "") || 0;
    return fixed + guests * reservationPrice;
  };

  const addonServicesTotal = (guests: number) => {
    let sum = 0;
    for (const s of addonServices) {
      if (!selectedServiceIds.has(s.id)) continue;
      sum += parseFloat(computeReservationServiceLineTotal(s.fixedPrice, s.pricePerMember, guests));
    }
    return sum;
  };

  const grandTotal = (guests: number) =>
    (baseReservationTotal(guests) + addonServicesTotal(guests)).toFixed(2);

  const loadSociety = async () => {
    try {
      const response = await authFetch("/api/societies/user");
      if (response.ok) {
        const data = (await response.json()) as Society;
        setSociety(data);
      }
    } catch (error) {
      console.error("Error loading society:", error);
    }
  };

  useEffect(() => {
    if (open) {
      void loadSociety();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await authFetch("/api/reservation-services");
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as ReservationService[];
        const list = Array.isArray(data) ? data : [];
        if (cancelled) return;
        setAddonServices(list);
        const init = new Set<string>();
        for (const s of list) {
          if (s.isDefault) init.add(s.id);
        }
        setSelectedServiceIds(init);
      } catch (e) {
        console.error("Error loading reservation services:", e);
        if (!cancelled) {
          setAddonServices([]);
          setSelectedServiceIds(new Set());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!society) return;
    const allowed = normalizeSocietyReservationMealTypes(society.reservationMealTypes).map(
      m => m.id
    );
    setFormData(prev =>
      allowed.includes(prev.type)
        ? prev
        : { ...prev, type: allowed[0] ?? DEFAULT_RESERVATION_MEAL_TYPES[0].id }
    );
  }, [society]);

  useEffect(() => {
    if (!open || defaultStartDate == null) return;
    setFormData(prev => ({
      ...prev,
      startDate: new Date(defaultStartDate),
    }));
  }, [open, defaultStartDate]);

  const reservationInstant = useMemo(() => {
    const d =
      formData.startDate instanceof Date ? formData.startDate : new Date(formData.startDate);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [formData.startDate]);

  useEffect(() => {
    if (!open || !reservationInstant) {
      setTables([]);
      return;
    }
    let cancelled = false;
    setTablesLoading(true);
    const params = new URLSearchParams({
      startDate: reservationInstant.toISOString(),
      type: formData.type,
    });
    void (async () => {
      try {
        const response = await authFetch(`/api/tables/available?${params.toString()}`);
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as TableWithOccupancy[];
        if (!cancelled) setTables(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Error loading tables:", e);
        if (!cancelled) setTables([]);
      } finally {
        if (!cancelled) setTablesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, reservationInstant, formData.type]);

  useEffect(() => {
    if (!formData.table) return;
    const tbl = tables.find(x => x.name === formData.table);
    if (tbl && !isTableSuitableForGuests(tbl, formData.guests)) {
      setFormData(prev => ({ ...prev, table: "" }));
    }
  }, [tables, formData.guests, formData.table]);

  useEffect(() => {
    if (!open || !reservationInstant) {
      setCalendarBlockNotes([]);
      return;
    }
    let cancelled = false;
    const from = startOfDay(reservationInstant).toISOString();
    const to = endOfDay(reservationInstant).toISOString();
    void (async () => {
      try {
        const res = await authFetch(
          `/api/society-events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        );
        if (!res.ok) return;
        const events = (await res.json()) as SocietyEvent[];
        if (cancelled) return;
        const tableId = tables.find(x => x.name === formData.table)?.id;
        const msgs: string[] = [];
        for (const ev of events) {
          const evS = new Date(ev.startDate);
          const evE = new Date(ev.endDate);
          if (reservationInstant < evS || reservationInstant > evE) continue;
          if (ev.blocksAllReservations) msgs.push(t("societyClosedOnDate"));
          const kitchenSvc = addonServices.find(s => s.slug === RESERVATION_SERVICE_SLUG_KITCHEN);
          const kitchenSelected = kitchenSvc ? selectedServiceIds.has(kitchenSvc.id) : false;
          if (kitchenSelected && ev.blocksKitchen) msgs.push(t("kitchenBlockedOnDate"));
          if (tableId && (ev.blockedTableIds ?? []).includes(tableId)) {
            msgs.push(t("tableBlockedOnDate"));
          }
        }
        setCalendarBlockNotes([...new Set(msgs)]);
      } catch {
        if (!cancelled) setCalendarBlockNotes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, reservationInstant, formData.table, selectedServiceIds, addonServices, tables, t]);

  const mapSrc = society ? societyMapSrc(society.id, society.mapImageUrl) : undefined;

  const handleCreateReservation = async () => {
    if (prepaymentBlocks) {
      toast({
        title: t("error"),
        description: t("prepaymentLedgerBannerDescription"),
        variant: "destructive",
      });
      return;
    }

    if (!formData.table) {
      toast({
        title: t("error"),
        description: t("selectTable"),
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const selected = tables.find(x => x.name === formData.table);
      if (!selected || !isTableSuitableForGuests(selected, formData.guests)) {
        throw new Error(t("tableGuestsExceedCapacity", { guests: String(formData.guests) }));
      }

      let startDate: Date;
      if (formData.startDate instanceof Date) {
        startDate = formData.startDate;
      } else {
        startDate = new Date(formData.startDate);
      }

      if (isNaN(startDate.getTime())) {
        throw new Error(t("invalidDate"));
      }

      const reservationData = {
        type: formData.type,
        guests: formData.guests,
        table: formData.table,
        selectedServiceIds: Array.from(selectedServiceIds),
        startDate: startDate.toISOString(),
        notes: formData.notes.trim() || undefined,
      };

      const response = await authFetch("/api/reservations", {
        method: "POST",
        body: JSON.stringify(reservationData),
      });

      if (response.ok) {
        await response.json();

        toast({
          title: t("success"),
          description: t("reservationCreated"),
        });

        setFormData({
          type:
            mealTypes[0]?.id ??
            normalizeSocietyReservationMealTypes(society?.reservationMealTypes)[0]?.id ??
            DEFAULT_RESERVATION_MEAL_TYPES[0].id,
          startDate: new Date(),
          guests: 10,
          table: "",
          notes: "",
        });
        const init = new Set<string>();
        for (const s of addonServices) {
          if (s.isDefault) init.add(s.id);
        }
        setSelectedServiceIds(init);

        onOpenChange(false);
        onSuccess?.();
      } else {
        const error = await response.json();
        throw new Error(error.message || t("errorCreatingReservation"));
      }
    } catch (error) {
      console.error("Error creating reservation:", error);
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : t("errorCreatingReservation"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedTableRow = formData.table ? tables.find(x => x.name === formData.table) : undefined;
  const selectedTableInvalid =
    Boolean(formData.table && selectedTableRow) &&
    !isTableSuitableForGuests(selectedTableRow!, formData.guests);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-lg max-h-[85vh] flex flex-col gap-0 p-0"
          data-testid="dialog-content"
        >
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0 space-y-1.5">
            <DialogTitle>{t("newReservation")}</DialogTitle>
            <DialogDescription>{t("fillReservationDetails")}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-5">
            {calendarBlockNotes.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t("calendarWarningBlockedTitle")}</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 mt-2 space-y-1">
                    {calendarBlockNotes.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>{t("date")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="date-picker-button"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.startDate
                      ? format(formData.startDate, "PPP", { locale: dateFnsLocale(language) })
                      : t("selectDate")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.startDate}
                    onSelect={date => date && setFormData(prev => ({ ...prev, startDate: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("type")}</Label>
                <Select
                  value={formData.type}
                  onValueChange={value => setFormData(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger data-testid="select-reservation-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {mealTypes.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {getReservationMealTypeLabel(mealTypes, m.id, language)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("guests")}</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.guests}
                  onChange={e => {
                    const g = parseInt(e.target.value, 10) || 1;
                    setFormData(prev => ({
                      ...prev,
                      guests: g,
                    }));
                  }}
                  data-testid="input-guests"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="mb-0">{t("table")}</Label>
                {mapSrc ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto p-0 text-sm text-primary underline-offset-4 hover:underline"
                    onClick={() => setMapDialogOpen(true)}
                  >
                    {t("viewReservationMapLink")}
                  </Button>
                ) : null}
              </div>
              <Select
                value={formData.table}
                onValueChange={value => setFormData(prev => ({ ...prev, table: value }))}
                disabled={tablesLoading}
              >
                <SelectTrigger data-testid="select-table">
                  <SelectValue placeholder={tablesLoading ? t("loading") : t("selectTable")} />
                </SelectTrigger>
                <SelectContent>
                  {tables.length > 0 ? (
                    tables.map(table => {
                      const suitable = isTableSuitableForGuests(table, formData.guests);
                      const rem = table.seatsRemaining;
                      const capHint =
                        rem !== undefined && table.allowsPartialReservation
                          ? t("tableSeatsRemainingShort", {
                              remaining: String(rem),
                              max: String(table.maxCapacity),
                            })
                          : `${table.minCapacity ?? "?"}–${table.maxCapacity ?? "?"} ${t("persons")}`;

                      return (
                        <SelectItem key={table.id} value={table.name} disabled={!suitable}>
                          <div className="flex flex-col">
                            <span>{table.name}</span>
                            <span className="text-xs text-muted-foreground">{capHint}</span>
                          </div>
                        </SelectItem>
                      );
                    })
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      {tablesLoading ? t("loading") : t("tableNoTablesAvailable")}
                    </div>
                  )}
                </SelectContent>
              </Select>
              {selectedTableInvalid && (
                <p className="text-sm text-amber-600">
                  {t("tableGuestsExceedCapacity", { guests: String(formData.guests) })}
                </p>
              )}
            </div>

            {addonServices.length > 0 ? (
              <div className="space-y-2">
                <Label>{t("reservationOptionalServices")}</Label>
                <div className="space-y-2 rounded-md border p-3">
                  {addonServices.map(svc => {
                    const line = computeReservationServiceLineTotal(
                      svc.fixedPrice,
                      svc.pricePerMember,
                      formData.guests
                    );
                    const label = reservationServiceDisplayLabel(svc, language);
                    return (
                      <div key={svc.id} className="flex items-start space-x-2">
                        <Checkbox
                          id={`rs-${svc.id}`}
                          checked={selectedServiceIds.has(svc.id)}
                          onCheckedChange={checked => {
                            setSelectedServiceIds(prev => {
                              const n = new Set(prev);
                              if (checked === true) n.add(svc.id);
                              else n.delete(svc.id);
                              return n;
                            });
                          }}
                          data-testid={`checkbox-reservation-service-${svc.slug}`}
                        />
                        <div className="flex-1 min-w-0">
                          <Label htmlFor={`rs-${svc.id}`} className="font-normal cursor-pointer">
                            {label}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            +{line}€ {t("forThisBooking")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <Card className="bg-muted/50" data-testid="reservation-cost-card">
              <CardContent className="pt-4">
                {society ? (
                  <>
                    {(() => {
                      const fixed = parseFloat(String(society.reservationFixedFee ?? "0")) || 0;
                      const per = parseFloat(society.reservationPricePerMember ?? "") || 0;
                      const variable = formData.guests * per;
                      return (
                        <>
                          {fixed > 0 ? (
                            <div className="flex justify-between text-sm">
                              <span>{t("reservationFixedFee")}</span>
                              <span>{fixed.toFixed(2)}€</span>
                            </div>
                          ) : null}
                          {variable > 0 || fixed === 0 ? (
                            <div className="flex justify-between text-sm">
                              <span>
                                {t("reservationCostVariablePart", {
                                  guests: String(formData.guests),
                                  price: String(society.reservationPricePerMember ?? "0"),
                                })}
                                :
                              </span>
                              <span>{variable.toFixed(2)}€</span>
                            </div>
                          ) : null}
                        </>
                      );
                    })()}
                    {addonServices
                      .filter(s => selectedServiceIds.has(s.id))
                      .map(svc => {
                        const line = computeReservationServiceLineTotal(
                          svc.fixedPrice,
                          svc.pricePerMember,
                          formData.guests
                        );
                        const label = reservationServiceDisplayLabel(svc, language);
                        return (
                          <div key={svc.id} className="flex justify-between text-sm mt-1">
                            <span className="truncate pr-2">{label}</span>
                            <span>{line}€</span>
                          </div>
                        );
                      })}
                  </>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span>{t("loading")}...</span>
                  </div>
                )}
                <div className="flex justify-between font-medium mt-2 pt-2 border-t">
                  <span>{t("totalCost")}:</span>
                  <span data-testid="reservation-grand-total">{grandTotal(formData.guests)}€</span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label>{t("notes")}</Label>
              <Textarea
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t("notesPlaceholder")}
                rows={3}
              />
            </div>
          </div>

          <div className="shrink-0 flex justify-end gap-2 border-t px-6 py-4 bg-background">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleCreateReservation}
              data-testid="button-save-reservation"
              disabled={
                !formData.table ||
                loading ||
                prepaymentBlocks ||
                selectedTableInvalid ||
                tablesLoading
              }
            >
              {loading ? t("loading") : t("reserve")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("reservationFloorPlan")}</DialogTitle>
            <DialogDescription>{t("reservationMapDialogDescription")}</DialogDescription>
          </DialogHeader>
          {mapSrc ? (
            <img
              src={mapSrc}
              alt={t("reservationFloorPlanAlt")}
              className="w-full h-auto rounded-md border object-contain max-h-[70vh]"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
