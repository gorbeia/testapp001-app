import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar as BigCalendar,
  Navigate,
  dateFnsLocalizer,
  type EventProps,
  type SlotInfo,
  type ToolbarProps,
  type View,
} from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { format, getDay, startOfDay, startOfWeek, endOfDay, addHours } from "date-fns";
import { eu, es } from "date-fns/locale";
import { CalendarDays, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import type { Reservation, SocietyEvent, Table } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/lib/i18n";
import { dateFnsLocale } from "@/lib/date-locale";
import { authFetch } from "@/lib/api";
import { readJsonOrThrow } from "@/lib/http-error";
import { useAuth, userCan } from "@/lib/auth";
import { Permission } from "@shared/permissions";
import { SocietyEventDialog, CALENDAR_SOCIETY_EVENTS_QUERY_KEY } from "@/components/SocietyEventDialog";
import { ReservationDialog } from "@/components/ReservationDialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export const CALENDAR_RESERVATIONS_QUERY_KEY = "calendar-reservations";

type ReservationRow = Reservation & { userName?: string | null };

type GridCalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  kind: "society-event" | "reservation";
  societyType?: string;
  blocks?: boolean;
  original: SocietyEvent | ReservationRow;
};

const localizer = dateFnsLocalizer({
  format,
  startOfWeek,
  getDay,
  locales: { eu, es },
});

function toolbarViewNames(
  views: ToolbarProps<GridCalendarEvent>["views"]
): View[] {
  if (Array.isArray(views)) {
    return views as View[];
  }
  return (Object.entries(views) as [View, boolean][])
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);
}

function CalendarToolbar(props: ToolbarProps<GridCalendarEvent>) {
  const { label, localizer: loc, onNavigate, onView, view, views } = props;
  const messages = loc.messages;
  const names = toolbarViewNames(views);
  return (
    <div className="rbc-toolbar">
      <span className="rbc-btn-group">
        <button type="button" onClick={() => onNavigate(Navigate.TODAY)}>
          {messages.today}
        </button>
        <button type="button" onClick={() => onNavigate(Navigate.PREVIOUS)}>
          {messages.previous}
        </button>
        <button type="button" onClick={() => onNavigate(Navigate.NEXT)}>
          {messages.next}
        </button>
      </span>
      <span className="rbc-toolbar-label">{label}</span>
      <span className="rbc-btn-group">
        {names.map(name => (
          <button
            key={name}
            type="button"
            data-testid={`calendar-view-${name}`}
            className={cn({ "rbc-active": view === name })}
            onClick={() => onView(name)}
          >
            {messages[name]}
          </button>
        ))}
      </span>
    </div>
  );
}

/** Typical meal time when picking a day from the calendar (local). */
function defaultReservationStartForDay(day: Date): Date {
  const d = startOfDay(day);
  d.setHours(18, 30, 0, 0);
  return d;
}

function rangeOverlapsDay(rangeStart: Date, rangeEnd: Date, day: Date): boolean {
  const a = startOfDay(day);
  const b = endOfDay(day);
  return rangeStart <= b && rangeEnd >= a;
}

function reservationTouchesDay(res: Reservation, day: Date): boolean {
  const d = new Date(res.startDate);
  return rangeOverlapsDay(d, d, day);
}

function eventStyleFor(event: GridCalendarEvent): CSSProperties {
  if (event.kind === "reservation") {
    return {
      backgroundColor: "hsl(142 76% 32%)",
      color: "hsl(0 0% 100%)",
      borderLeft: "3px solid hsl(142 76% 22%)",
      borderRadius: "4px",
      fontSize: "0.7rem",
      lineHeight: 1.2,
      padding: "1px 4px",
    };
  }
  const ty = event.societyType ?? "other";
  switch (ty) {
    case "closure":
    case "maintenance":
      return {
        backgroundColor: "hsl(215 16% 40%)",
        color: "hsl(0 0% 100%)",
        borderLeft: "3px solid hsl(215 20% 28%)",
        borderRadius: "4px",
        fontSize: "0.7rem",
        lineHeight: 1.2,
        padding: "1px 4px",
      };
    case "party":
      return {
        backgroundColor: "hsl(263 70% 45%)",
        color: "hsl(0 0% 100%)",
        borderLeft: "3px solid hsl(263 70% 32%)",
        borderRadius: "4px",
        fontSize: "0.7rem",
        lineHeight: 1.2,
        padding: "1px 4px",
      };
    case "assembly":
      return {
        backgroundColor: "hsl(38 92% 42%)",
        color: "hsl(0 0% 10%)",
        borderLeft: "3px solid hsl(38 92% 28%)",
        borderRadius: "4px",
        fontSize: "0.7rem",
        lineHeight: 1.2,
        padding: "1px 4px",
      };
    default:
      return {
        backgroundColor: "hsl(199 89% 40%)",
        color: "hsl(0 0% 100%)",
        borderLeft: "3px solid hsl(199 89% 28%)",
        borderRadius: "4px",
        fontSize: "0.7rem",
        lineHeight: 1.2,
        padding: "1px 4px",
      };
  }
}

export function CalendarPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManageCalendar = user ? userCan(user, Permission.CALENDAR_MANAGE) : false;

  const culture = language === "eu" ? "eu" : "es";

  const [month, setMonth] = useState(() => new Date());
  const monthParam = format(month, "yyyy-MM");
  const [calendarView, setCalendarView] = useState<View>("month");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDate, setSheetDate] = useState<Date | null>(null);

  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventDialogAnchor, setEventDialogAnchor] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<SocietyEvent | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<SocietyEvent | null>(null);
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false);
  const [reservationDialogDefaultStart, setReservationDialogDefaultStart] = useState<Date | null>(
    null
  );

  const dateLocale = dateFnsLocale(language);

  const { data: societyEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: [CALENDAR_SOCIETY_EVENTS_QUERY_KEY, monthParam],
    queryFn: async () => {
      const res = await authFetch(
        `/api/society-events?month=${encodeURIComponent(monthParam)}`
      );
      return readJsonOrThrow<SocietyEvent[]>(res);
    },
  });

  const { data: reservations = [], isLoading: reservationsLoading } = useQuery({
    queryKey: [CALENDAR_RESERVATIONS_QUERY_KEY, monthParam],
    queryFn: async () => {
      const res = await authFetch(
        `/api/reservations?month=${encodeURIComponent(monthParam)}&forCalendar=true&limit=500&page=1`
      );
      const body = await readJsonOrThrow<{
        data?: ReservationRow[];
        reservations?: ReservationRow[];
      }>(res);
      return body.data ?? body.reservations ?? [];
    },
  });

  const { data: tables = [] } = useQuery({
    queryKey: ["/api/tables/available"],
    queryFn: async () => {
      const res = await authFetch("/api/tables/available");
      return readJsonOrThrow<Table[]>(res);
    },
  });

  const calendarEvents = useMemo((): GridCalendarEvent[] => {
    const out: GridCalendarEvent[] = [];
    for (const ev of societyEvents) {
      out.push({
        id: `se-${ev.id}`,
        title: ev.title,
        start: new Date(ev.startDate),
        end: new Date(ev.endDate),
        kind: "society-event",
        societyType: ev.type,
        blocks:
          ev.blocksAllReservations ||
          ev.blocksKitchen ||
          (ev.blockedTableIds?.length ?? 0) > 0,
        original: ev,
      });
    }
    for (const res of reservations) {
      const start = new Date(res.startDate);
      out.push({
        id: `res-${res.id}`,
        title: res.name,
        start,
        end: addHours(start, 1),
        kind: "reservation",
        original: res,
      });
    }
    return out;
  }, [societyEvents, reservations]);

  const eventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      closure: t("eventTypeClosure"),
      party: t("eventTypeParty"),
      assembly: t("eventTypeAssembly"),
      maintenance: t("eventTypeMaintenance"),
      other: t("eventTypeOther"),
    };
    return labels[type] ?? type;
  };

  const reservationTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      bazkaria: t("bazkaria"),
      afaria: t("afaria"),
      askaria: t("askaria"),
      hamaiketakako: t("hamaiketakoa"),
    };
    return labels[type] ?? type;
  };

  const dayEvents = useMemo(() => {
    if (!sheetDate) return [];
    return societyEvents.filter(ev =>
      rangeOverlapsDay(new Date(ev.startDate), new Date(ev.endDate), sheetDate)
    );
  }, [societyEvents, sheetDate]);

  const dayReservations = useMemo(() => {
    if (!sheetDate) return [];
    return reservations.filter(r => reservationTouchesDay(r, sheetDate));
  }, [reservations, sheetDate]);

  const openNewEvent = (anchor: Date) => {
    setEditingEvent(null);
    setEventDialogAnchor(anchor);
    setEventDialogOpen(true);
  };

  const openEditEvent = (ev: SocietyEvent) => {
    setEditingEvent(ev);
    setEventDialogAnchor(null);
    setEventDialogOpen(true);
  };

  const openNewReservation = (day: Date) => {
    setReservationDialogDefaultStart(defaultReservationStartForDay(day));
    setReservationDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await authFetch(`/api/society-events/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.message === "string" ? j.message : t("error"));
      }
      toast({ title: t("success"), description: t("calendarEventDeleted") });
      await queryClient.invalidateQueries({
        predicate: q => q.queryKey[0] === CALENDAR_SOCIETY_EVENTS_QUERY_KEY,
      });
      setDeleteTarget(null);
    } catch (e) {
      toast({
        title: t("error"),
        description: e instanceof Error ? e.message : t("error"),
        variant: "destructive",
      });
    }
  };

  const eventPropGetter = useCallback((event: GridCalendarEvent) => {
    return {
      style: eventStyleFor(event),
    };
  }, []);

  const messages = useMemo(
    () => ({
      month: t("calendarMonthView"),
      week: "",
      work_week: "",
      day: "",
      agenda: t("calendarAgendaView"),
      previous: t("previous"),
      next: t("next"),
      today: t("today"),
      allDay: t("fullDay"),
      date: t("date"),
      time: t("time"),
      event: t("calendarLegendEvents"),
      noEventsInRange: t("calendarNoEventsInRange"),
      showMore: (count: number) => t("calendarShowMore", { count }),
    }),
    [t]
  );

  function MonthEventCard(props: EventProps<GridCalendarEvent>) {
    const { event } = props;
    if (event.kind === "reservation") {
      const r = event.original as ReservationRow;
      return (
        <div className="truncate leading-tight" title={`${event.title} · ${r.table}`}>
          <span className="font-medium">{event.title}</span>
          <span className="opacity-90"> · {r.table}</span>
          <span className="opacity-90">
            {" "}
            · {r.guests ?? 0} {t("guests").toLowerCase()}
          </span>
        </div>
      );
    }
    return (
      <div className="truncate leading-tight flex items-center gap-0.5 min-w-0" title={event.title}>
        {event.blocks ? <Lock className="h-3 w-3 shrink-0 opacity-90" aria-hidden /> : null}
        <span className="font-medium truncate">{event.title}</span>
      </div>
    );
  }

  const loading = eventsLoading || reservationsLoading;

  return (
    <div className="p-4 sm:p-6 space-y-6 w-full max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <CalendarDays className="h-7 w-7" />
            {t("calendar")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("calendarDescription")}</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            type="button"
            variant="default"
            onClick={() => openNewReservation(sheetDate ?? month)}
            data-testid="button-new-reservation"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("newReservation")}
          </Button>
          {canManageCalendar && (
            <Button
              type="button"
              onClick={() => openNewEvent(sheetDate ?? month)}
              data-testid="calendar-add-event"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("calendarAddEvent")}
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardDescription>
            <span className="inline-flex items-center gap-3 flex-wrap text-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                {t("calendarLegendEvents")}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                {t("calendarLegendReservations")}
              </span>
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 px-2 sm:px-4 pb-4">
          {loading ? (
            <p className="text-muted-foreground py-16 text-center">{t("loading")}…</p>
          ) : (
            <div
              className={cn(
                "rbc-root w-full rounded-md border bg-card text-card-foreground",
                "[&_.rbc-toolbar]:flex-wrap [&_.rbc-toolbar]:gap-2 [&_.rbc-toolbar]:mb-3",
                "[&_.rbc-header]:border-border [&_.rbc-day-bg]:border-border [&_.rbc-month-view]:border-border",
                "[&_.rbc-agenda-view]:border-border [&_.rbc-agenda-table]:border-border",
                "[&_.rbc-off-range-bg]:bg-muted/40 [&_.rbc-today]:bg-accent/30"
              )}
              data-testid="calendar-big-calendar"
            >
              <BigCalendar<GridCalendarEvent>
                localizer={localizer}
                culture={culture}
                messages={messages}
                events={calendarEvents}
                startAccessor="start"
                endAccessor="end"
                titleAccessor="title"
                view={calendarView}
                views={["month", "agenda"]}
                date={month}
                onNavigate={newDate => {
                  setMonth(newDate);
                }}
                onView={next => {
                  setCalendarView(next);
                }}
                onSelectSlot={(slotInfo: SlotInfo) => {
                  setSheetDate(startOfDay(slotInfo.start));
                  setSheetOpen(true);
                }}
                selectable={calendarView === "month"}
                onSelectEvent={(event: GridCalendarEvent) => {
                  if (event.kind === "society-event" && canManageCalendar) {
                    openEditEvent(event.original as SocietyEvent);
                  } else {
                    setSheetDate(startOfDay(event.start));
                    setSheetOpen(true);
                  }
                }}
                popup
                eventPropGetter={eventPropGetter}
                components={{
                  toolbar: CalendarToolbar,
                  month: {
                    event: MonthEventCard,
                  },
                }}
                style={{ minHeight: "560px", height: "calc(100vh - 14rem)" }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {sheetDate
                ? format(sheetDate, "PPP", { locale: dateLocale })
                : t("calendar")}
            </SheetTitle>
            <SheetDescription>
              {t("calendarDaySocietyEvents")} / {t("calendarDayReservations")}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {sheetDate && (
              <Button
                type="button"
                variant="default"
                className="w-full"
                onClick={() => {
                  openNewReservation(sheetDate);
                  setSheetOpen(false);
                }}
                data-testid="calendar-sheet-new-reservation"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("newReservation")}
              </Button>
            )}
            {canManageCalendar && sheetDate && (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => openNewEvent(sheetDate)}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("calendarAddEvent")}
              </Button>
            )}

            <div>
              <h3 className="text-sm font-medium mb-2">{t("calendarDaySocietyEvents")}</h3>
              {dayEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("calendarNoEventsThisDay")}</p>
              ) : (
                <ul className="space-y-3">
                  {dayEvents.map(ev => (
                    <li key={ev.id} className="rounded-md border p-3 text-sm space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{ev.title}</p>
                          <Badge variant="secondary" className="mt-1">
                            {eventTypeLabel(ev.type)}
                          </Badge>
                        </div>
                        {canManageCalendar && (
                          <div className="flex gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={t("calendarEditEvent")}
                              onClick={() => openEditEvent(ev)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={t("calendarDeleteEvent")}
                              onClick={() => setDeleteTarget(ev)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {ev.isFullDay
                          ? t("fullDay")
                          : `${format(new Date(ev.startDate), "p", { locale: dateLocale })} – ${format(
                              new Date(ev.endDate),
                              "p",
                              { locale: dateLocale }
                            )}`}
                      </p>
                      <div className="flex flex-wrap gap-1 text-xs">
                        {ev.blocksAllReservations && (
                          <Badge variant="outline">{t("eventBlockingSummaryAll")}</Badge>
                        )}
                        {ev.blocksKitchen && (
                          <Badge variant="outline">{t("eventBlockingSummaryKitchen")}</Badge>
                        )}
                        {(ev.blockedTableIds?.length ?? 0) > 0 && (
                          <Badge variant="outline">{t("eventBlockingSummaryTables")}</Badge>
                        )}
                      </div>
                      {ev.notes && <p className="text-xs text-muted-foreground">{ev.notes}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Separator />

            <div>
              <h3 className="text-sm font-medium mb-2">{t("calendarDayReservations")}</h3>
              {dayReservations.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("calendarNoReservationsThisDay")}</p>
              ) : (
                <ul className="space-y-2">
                  {dayReservations.map(res => (
                    <li key={res.id} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">{res.name}</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        {reservationTypeLabel(res.type)} · {res.table} ·{" "}
                        {format(new Date(res.startDate), "p", { locale: dateLocale })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("guests")}: {res.guests ?? 0}
                        {res.useKitchen ? ` · ${t("kitchenEquipment")}` : ""}
                      </p>
                      <Badge
                        variant={res.status === "confirmed" ? "default" : "secondary"}
                        className="mt-2"
                      >
                        {res.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ReservationDialog
        open={reservationDialogOpen}
        onOpenChange={open => {
          setReservationDialogOpen(open);
          if (!open) setReservationDialogDefaultStart(null);
        }}
        defaultStartDate={reservationDialogDefaultStart ?? undefined}
        onSuccess={() => {
          void queryClient.invalidateQueries({
            predicate: q => q.queryKey[0] === CALENDAR_RESERVATIONS_QUERY_KEY,
          });
        }}
      />

      <SocietyEventDialog
        open={eventDialogOpen}
        onOpenChange={open => {
          setEventDialogOpen(open);
          if (!open) setEditingEvent(null);
        }}
        anchorDate={eventDialogAnchor}
        editing={editingEvent}
        tables={tables}
        onSuccess={() => {
          void queryClient.invalidateQueries({
            predicate: q => q.queryKey[0] === CALENDAR_RESERVATIONS_QUERY_KEY,
          });
        }}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("calendarDeleteEvent")}</AlertDialogTitle>
            <AlertDialogDescription>{t("calendarDeleteEventConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>
              {t("calendarDeleteEvent")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
