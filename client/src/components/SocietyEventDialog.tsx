import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createSocietyEventBodySchema,
  type SocietyEvent,
  type SocietyEventType,
  type Table,
} from "@shared/schema";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n";
import { authFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const formSchema = createSocietyEventBodySchema;
export type SocietyEventFormValues = z.infer<typeof formSchema>;

export const CALENDAR_SOCIETY_EVENTS_QUERY_KEY = "calendar-society-events";

function parseInputDate(iso: string): Date {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function eventToFormValues(ev: SocietyEvent): SocietyEventFormValues {
  return {
    title: ev.title,
    type: ev.type as SocietyEventType,
    isFullDay: ev.isFullDay,
    startDate: new Date(ev.startDate),
    endDate: new Date(ev.endDate),
    blocksAllReservations: ev.blocksAllReservations,
    blocksKitchen: ev.blocksKitchen,
    blockedTableIds: [...(ev.blockedTableIds ?? [])],
    notes: ev.notes ?? undefined,
  };
}

export function SocietyEventDialog({
  open,
  onOpenChange,
  anchorDate,
  editing,
  tables,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorDate: Date | null;
  editing: SocietyEvent | null;
  tables: Table[];
  onSuccess?: () => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<SocietyEventFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      type: "other",
      isFullDay: true,
      startDate: new Date(),
      endDate: new Date(),
      blocksAllReservations: false,
      blocksKitchen: false,
      blockedTableIds: [],
      notes: "",
    },
  });

  const isFullDay = form.watch("isFullDay");

  // eslint-disable-next-line react-hooks/exhaustive-deps -- form.reset is stable for this dialog lifecycle
  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset(eventToFormValues(editing));
      return;
    }
    const base = anchorDate ? new Date(anchorDate) : new Date();
    const start = new Date(base);
    start.setHours(0, 0, 0, 0);
    const end = new Date(base);
    end.setHours(23, 59, 59, 999);
    form.reset({
      title: "",
      type: "other",
      isFullDay: true,
      startDate: start,
      endDate: end,
      blocksAllReservations: false,
      blocksKitchen: false,
      blockedTableIds: [],
      notes: "",
    });
  }, [open, editing?.id, anchorDate?.getTime()]);

  const eventTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      closure: t("eventTypeClosure"),
      party: t("eventTypeParty"),
      assembly: t("eventTypeAssembly"),
      maintenance: t("eventTypeMaintenance"),
      other: t("eventTypeOther"),
    };
    return map[type] ?? type;
  };

  const onSubmit = form.handleSubmit(async data => {
    try {
      const payload = {
        ...data,
        blockedTableIds: data.blockedTableIds ?? [],
        startDate: data.startDate.toISOString(),
        endDate: data.endDate.toISOString(),
      };

      const url = editing ? `/api/society-events/${editing.id}` : "/api/society-events";
      const method = editing ? "PUT" : "POST";
      const res = await authFetch(url, {
        method,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(typeof errBody.message === "string" ? errBody.message : t("error"));
      }

      toast({
        title: t("success"),
        description: t("calendarEventSaved"),
      });
      await queryClient.invalidateQueries({
        predicate: q => q.queryKey[0] === CALENDAR_SOCIETY_EVENTS_QUERY_KEY,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      toast({
        title: t("error"),
        description: e instanceof Error ? e.message : t("error"),
        variant: "destructive",
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t("calendarEditEvent") : t("calendarAddEvent")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ev-title">{t("eventTitle")}</Label>
            <Input id="ev-title" {...form.register("title")} />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("eventType")}</Label>
            <Controller
              name="type"
              control={form.control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      ["closure", "party", "assembly", "maintenance", "other"] as SocietyEventType[]
                    ).map(ty => (
                      <SelectItem key={ty} value={ty}>
                        {eventTypeLabel(ty)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="ev-fullday" className="cursor-pointer">
              {t("fullDay")}
            </Label>
            <Controller
              name="isFullDay"
              control={form.control}
              render={({ field }) => (
                <Switch id="ev-fullday" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>

          {!isFullDay ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ev-start">{t("eventStartTime")}</Label>
                <Input
                  id="ev-start"
                  type="datetime-local"
                  value={toDatetimeLocalValue(form.watch("startDate"))}
                  onChange={e =>
                    form.setValue("startDate", parseInputDate(e.target.value), {
                      shouldValidate: true,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-end">{t("eventEndTime")}</Label>
                <Input
                  id="ev-end"
                  type="datetime-local"
                  value={toDatetimeLocalValue(form.watch("endDate"))}
                  onChange={e =>
                    form.setValue("endDate", parseInputDate(e.target.value), {
                      shouldValidate: true,
                    })
                  }
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ev-sdt">{t("eventStartDate")}</Label>
                <Input
                  id="ev-sdt"
                  type="date"
                  value={toDateInputValue(form.watch("startDate"))}
                  onChange={e => {
                    const next = parseDateInputPreserveTime(
                      e.target.value,
                      form.getValues("startDate")
                    );
                    form.setValue("startDate", next, { shouldValidate: true });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-edt">{t("eventEndDate")}</Label>
                <Input
                  id="ev-edt"
                  type="date"
                  value={toDateInputValue(form.watch("endDate"))}
                  onChange={e => {
                    const next = parseDateInputPreserveTime(
                      e.target.value,
                      form.getValues("endDate")
                    );
                    form.setValue("endDate", next, { shouldValidate: true });
                  }}
                />
              </div>
            </div>
          )}
          {(form.formState.errors.startDate || form.formState.errors.endDate) && (
            <p className="text-sm text-destructive">
              {form.formState.errors.endDate?.message ?? form.formState.errors.startDate?.message}
            </p>
          )}

          <div className="space-y-3 border rounded-md p-3">
            <div className="flex items-center gap-2">
              <Controller
                name="blocksAllReservations"
                control={form.control}
                render={({ field }) => (
                  <Checkbox id="ev-ball" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="ev-ball" className="cursor-pointer font-normal">
                {t("blocksAllReservations")}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Controller
                name="blocksKitchen"
                control={form.control}
                render={({ field }) => (
                  <Checkbox id="ev-bkit" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="ev-bkit" className="cursor-pointer font-normal">
                {t("blocksKitchen")}
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("blockedTables")}</Label>
            <div className="border rounded-md max-h-36 overflow-y-auto p-2 space-y-2">
              {tables.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("selectTable")}</p>
              ) : (
                tables.map(tbl => (
                  <div key={tbl.id} className="flex items-center gap-2">
                    <Controller
                      name="blockedTableIds"
                      control={form.control}
                      render={({ field }) => {
                        const set = new Set(field.value ?? []);
                        const checked = set.has(tbl.id);
                        return (
                          <Checkbox
                            id={`tbl-${tbl.id}`}
                            checked={checked}
                            onCheckedChange={() => {
                              const next = new Set(set);
                              if (checked) next.delete(tbl.id);
                              else next.add(tbl.id);
                              field.onChange([...next]);
                            }}
                          />
                        );
                      }}
                    />
                    <Label htmlFor={`tbl-${tbl.id}`} className="cursor-pointer font-normal">
                      {tbl.name}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ev-notes">{t("eventNotes")}</Label>
            <Textarea id="ev-notes" {...form.register("notes")} rows={3} />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit">{t("save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDatetimeLocalValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function parseDateInputPreserveTime(dateStr: string, ref: Date): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  if (!y || !mo || !d) return ref;
  const next = new Date(ref);
  next.setFullYear(y, mo - 1, d);
  return next;
}
