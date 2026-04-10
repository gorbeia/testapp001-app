import { useLanguage } from "@/lib/i18n";
import { useState, useEffect, useMemo } from "react";
import { authFetch } from "@/lib/api";
import type { Society } from "@shared/schema";
import { getReservationMealTypeLabel, normalizeSocietyReservationMealTypes } from "@shared/schema";
import {
  Note,
  fetchNotes,
  fetchUpcomingReservations,
  fetchTotalReservationsCount,
  UpcomingReservation,
  fetchDashboardStats,
  DashboardStats,
} from "./api";
import { WelcomeHeader } from "./WelcomeHeader";
import { StatsCards } from "./StatsCards";
import { UpcomingReservations } from "./UpcomingReservations";
import { RecentNotes } from "./RecentNotes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AccessDenied } from "@/components/AccessDenied";
import { isHttpForbidden } from "@/lib/http-error";
import { AlertCircle } from "lucide-react";

function errorMessageFromCatch(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function Dashboard() {
  const { t, language } = useLanguage();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [reservations, setReservations] = useState<UpcomingReservation[]>([]);
  const [totalReservationsCount, setTotalReservationsCount] = useState(0);
  const [loadingReservations, setLoadingReservations] = useState(true);
  const [reservationsError, setReservationsError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [society, setSociety] = useState<Society | null>(null);

  useEffect(() => {
    fetchNotesData();
    fetchReservationsData();
    fetchStatsData();
    void (async () => {
      try {
        const res = await authFetch("/api/societies/user");
        if (res.ok) {
          setSociety((await res.json()) as Society);
        }
      } catch {
        setSociety(null);
      }
    })();
  }, [language]);

  const fetchNotesData = async () => {
    setLoadingNotes(true);
    setNotesError(null);
    try {
      const notesData = await fetchNotes(language);
      setNotes(notesData);
    } catch (error) {
      console.error("Error fetching notes:", error);
      setNotesError(errorMessageFromCatch(error, "Failed to load notes"));
      setNotes([]);
    } finally {
      setLoadingNotes(false);
    }
  };

  const fetchReservationsData = async () => {
    setLoadingReservations(true);
    setReservationsError(null);
    try {
      const [reservationsData, totalCount] = await Promise.all([
        fetchUpcomingReservations(5, language),
        fetchTotalReservationsCount(),
      ]);
      setReservations(reservationsData);
      setTotalReservationsCount(totalCount);
    } catch (error) {
      console.error("Error fetching reservations:", error);
      setReservationsError(errorMessageFromCatch(error, "Failed to load reservations"));
      setReservations([]);
      setTotalReservationsCount(0);
    } finally {
      setLoadingReservations(false);
    }
  };

  const fetchStatsData = async () => {
    setLoadingStats(true);
    setStatsError(null);
    try {
      const statsData = await fetchDashboardStats();
      setStats(statsData);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      setStatsError(errorMessageFromCatch(error, "Failed to load dashboard statistics"));
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  const mealTypes = normalizeSocietyReservationMealTypes(society?.reservationMealTypes);

  const eventTypeLabels = useMemo((): Record<string, string> => {
    const fromSociety = Object.fromEntries(
      mealTypes.map(m => [m.id, getReservationMealTypeLabel(mealTypes, m.id, language)])
    );
    return {
      ...fromSociety,
      urtebetetzea: t("birthday"),
    };
  }, [mealTypes, language, t]);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <WelcomeHeader />

      {statsError ? (
        isHttpForbidden(statsError) ? (
          <AccessDenied />
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{statsError}</AlertDescription>
          </Alert>
        )
      ) : (
        <StatsCards stats={stats} loading={loadingStats} />
      )}

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        {reservationsError ? (
          isHttpForbidden(reservationsError) ? (
            <AccessDenied />
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{reservationsError}</AlertDescription>
            </Alert>
          )
        ) : (
          <UpcomingReservations
            reservations={reservations}
            totalCount={totalReservationsCount}
            eventTypeLabels={eventTypeLabels}
            loading={loadingReservations}
          />
        )}

        <RecentNotes notes={notes} loading={loadingNotes} error={notesError} />
      </div>
    </div>
  );
}
