import { useState, useEffect, useMemo } from "react";
import { Calendar as CalendarIcon, Utensils } from "lucide-react";
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
import { format } from "date-fns";
import { eu, es } from "date-fns/locale";
import type { Society, SocietyEvent, Table } from "@shared/schema";
import { startOfDay, endOfDay } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface ReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** When set while the dialog opens, prefills the reservation date/time (e.g. from a calendar day). */
  defaultStartDate?: Date | null;
}

interface FormData {
  name: string;
  type: string;
  startDate: Date;
  guests: number;
  useKitchen: boolean;
  table: string;
  totalAmount: string;
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
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(false);
  const [calendarBlockNotes, setCalendarBlockNotes] = useState<string[]>([]);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    type: "bazkaria",
    startDate: new Date(),
    guests: 10,
    useKitchen: false,
    table: "",
    totalAmount: "0",
    notes: "",
  });

  // Event type labels
  const eventTypeLabels: Record<string, string> = {
    bazkaria: t("bazkaria"),
    afaria: t("afaria"),
    askaria: t("askaria"),
    hamaiketakako: t("hamaiketakoa"),
  };

  // Get all active tables
  const getAllTables = () => {
    return tables.filter(table => table.isActive);
  };

  // Check if selected table can accommodate guests
  const isTableSuitable = (tableName: string) => {
    const table = tables.find(t => t.name === tableName);
    if (!table || table.minCapacity === null || table.maxCapacity === null) return false;
    return formData.guests >= table.minCapacity && formData.guests <= table.maxCapacity;
  };

  const calculateTotal = (guests: number, kitchen: boolean) => {
    if (!society) return "0";

    const reservationPrice = parseFloat(society.reservationPricePerMember ?? "") || 2;
    const kitchenPrice = parseFloat(society.kitchenPricePerMember ?? "") || 3;

    const guestCharge = guests * reservationPrice;
    const kitchenCharge = kitchen ? guests * kitchenPrice : 0;
    return (guestCharge + kitchenCharge).toString();
  };

  // Load society data
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

  // Load tables
  const loadTables = async () => {
    try {
      const response = await authFetch("/api/tables/available");
      if (response.ok) {
        const data = await response.json();
        setTables(data);
      }
    } catch (error) {
      console.error("Error loading tables:", error);
    }
  };

  // Keep totalAmount in sync with society pricing when society loads (guests/kitchen update inline to avoid one-frame stale footer totals)
  useEffect(() => {
    if (!society) return;
    setFormData(prev => ({
      ...prev,
      totalAmount: calculateTotal(prev.guests, prev.useKitchen),
    }));
  }, [society]);

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadSociety();
      loadTables();
    }
  }, [open]);

  useEffect(() => {
    if (!open || defaultStartDate == null) return;
    setFormData(prev => ({
      ...prev,
      startDate: new Date(defaultStartDate),
    }));
  }, [open, defaultStartDate]);

  const reservationInstant = useMemo(() => {
    const d = formData.startDate instanceof Date ? formData.startDate : new Date(formData.startDate);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [formData.startDate]);

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
          if (formData.useKitchen && ev.blocksKitchen) msgs.push(t("kitchenBlockedOnDate"));
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
  }, [open, reservationInstant, formData.table, formData.useKitchen, tables]);

  const handleCreateReservation = async () => {
    if (prepaymentBlocks) {
      toast({
        title: t("error"),
        description: t("prepaymentLedgerBannerDescription"),
        variant: "destructive",
      });
      return;
    }
    if (!formData.name) {
      toast({
        title: t("error"),
        description: t("nameRequired"),
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

      // Validate table capacity
      if (formData.table && !isTableSuitable(formData.table)) {
        throw new Error(
          `Hautatutako mahaiak ez ditu ${formData.guests} pertsona hartzeko kapazitaterik. Mesedez, hautatu mahaia egoki bat.`
        );
      }

      // Ensure we have a valid Date object
      let startDate: Date;
      if (formData.startDate instanceof Date) {
        startDate = formData.startDate;
      } else {
        startDate = new Date(formData.startDate);
      }

      // Check if the date is valid
      if (isNaN(startDate.getTime())) {
        throw new Error(t("invalidDate"));
      }

      const reservationData = {
        ...formData,
        totalAmount: calculateTotal(formData.guests, formData.useKitchen),
        startDate: startDate.toISOString(),
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

        // Reset form
        setFormData({
          name: "",
          type: "bazkaria",
          startDate: new Date(),
          guests: 10,
          useKitchen: false,
          table: "",
          totalAmount: "0",
          notes: "",
        });

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-content">
        <DialogHeader>
          <DialogTitle>{t("newReservation")}</DialogTitle>
          <DialogDescription>{t("fillReservationDetails")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
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
            <Label>{t("name")}</Label>
            <Input
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Erreserbaren izena"
              data-testid="input-reservation-name"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("type")}</Label>
              <Select
                value={formData.type}
                onValueChange={value => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger data-testid="select-reservation-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bazkaria">{eventTypeLabels.bazkaria}</SelectItem>
                  <SelectItem value="afaria">{eventTypeLabels.afaria}</SelectItem>
                  <SelectItem value="askaria">{eventTypeLabels.askaria}</SelectItem>
                  <SelectItem value="hamaiketakako">{eventTypeLabels.hamaiketakako}</SelectItem>
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
                  const g = parseInt(e.target.value) || 1;
                  setFormData(prev => ({
                    ...prev,
                    guests: g,
                    totalAmount: calculateTotal(g, prev.useKitchen),
                  }));
                }}
                data-testid="input-guests"
              />
            </div>
          </div>

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
                    ? format(formData.startDate, "PPP", { locale: language === "eu" ? eu : es })
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

          <div className="space-y-2">
            <Label>{t("table")}</Label>
            <Select
              value={formData.table}
              onValueChange={value => setFormData(prev => ({ ...prev, table: value }))}
            >
              <SelectTrigger data-testid="select-table">
                <SelectValue placeholder={t("selectTable")} />
              </SelectTrigger>
              <SelectContent>
                {getAllTables().length > 0 ? (
                  getAllTables().map(table => {
                    const isSuitable =
                      table.minCapacity !== null &&
                      table.maxCapacity !== null &&
                      formData.guests >= table.minCapacity &&
                      formData.guests <= table.maxCapacity;

                    return (
                      <SelectItem key={table.id} value={table.name} disabled={!isSuitable}>
                        <div className="flex flex-col">
                          <span>{table.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {table.minCapacity ?? "?"}-{table.maxCapacity ?? "?"} pertsona
                            {!isSuitable && ` (Ez egokia ${formData.guests} pertsonentzat)`}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })
                ) : (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Ez dago mahairik eskuragarri
                  </div>
                )}
              </SelectContent>
            </Select>
            {formData.table && !isTableSuitable(formData.table) && (
              <p className="text-sm text-amber-600">
                {formData.table} mahaiak ez ditu {formData.guests} pertsona hartzeko kapazitaterik.
                Mahaiaren kapazitatea:{" "}
                {tables.find(t => t.name === formData.table)?.minCapacity ?? "?"}-
                {tables.find(t => t.name === formData.table)?.maxCapacity ?? "?"} pertsona.
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="kitchen"
              checked={formData.useKitchen}
              onCheckedChange={checked => {
                const useKitchen = checked === true;
                setFormData(prev => ({
                  ...prev,
                  useKitchen,
                  totalAmount: calculateTotal(prev.guests, useKitchen),
                }));
              }}
              data-testid="checkbox-kitchen"
            />
            <Label htmlFor="kitchen" className="flex items-center gap-2">
              <Utensils className="h-4 w-4" />
              {t("kitchenEquipment")}
            </Label>
          </div>

          <Card className="bg-muted/50" data-testid="reservation-cost-card">
            <CardContent className="pt-4">
              {society ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span>
                      {t("guests")} ({formData.guests} × {society.reservationPricePerMember ?? "0"}
                      €):
                    </span>
                    <span>
                      {(
                        formData.guests * parseFloat(society.reservationPricePerMember ?? "0")
                      ).toFixed(2)}
                      €
                    </span>
                  </div>
                  {formData.useKitchen && (
                    <div className="flex justify-between text-sm mt-1">
                      <span>
                        {t("kitchenCost")} ({formData.guests} ×{" "}
                        {society.kitchenPricePerMember ?? "0"}€):
                      </span>
                      <span>
                        {(
                          formData.guests * parseFloat(society.kitchenPricePerMember ?? "0")
                        ).toFixed(2)}
                        €
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between text-sm">
                  <span>{t("loading")}...</span>
                </div>
              )}
              <div className="flex justify-between font-medium mt-2 pt-2 border-t">
                <span>{t("totalCost")}:</span>
                <span>{formData.totalAmount}€</span>
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

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleCreateReservation}
              data-testid="button-save-reservation"
              disabled={!formData.name || !formData.table || loading || prepaymentBlocks}
            >
              {loading ? t("loading") : t("reserve")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
