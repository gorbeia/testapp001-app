import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useState, useEffect } from "react";
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
import { AlertCircle } from "lucide-react";

export function Dashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
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

  useEffect(() => {
    fetchNotesData();
    fetchReservationsData();
    fetchStatsData();
  }, []);

  const fetchNotesData = async () => {
    setLoadingNotes(true);
    setNotesError(null);
    try {
      const notesData = await fetchNotes(t("language") === "es" ? "es" : "eu");
      setNotes(notesData);
    } catch (error) {
      console.error("Error fetching notes:", error);
      setNotesError("Failed to load notes");
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
        fetchUpcomingReservations(5),
        fetchTotalReservationsCount(),
      ]);
      setReservations(reservationsData);
      setTotalReservationsCount(totalCount);
    } catch (error) {
      console.error("Error fetching reservations:", error);
      setReservationsError("Failed to load reservations");
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
      const statsData = await fetchDashboardStats(user);
      setStats(statsData);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      setStatsError("Failed to load dashboard statistics");
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  const eventTypeLabels: Record<string, string> = {
    hamaiketako: t("hamaiketakoa"),
    bazkaria: t("bazkaria"),
    askaria: t("askaria"),
    afaria: t("afaria"),
    urtebetetzea: t("birthday"),
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <WelcomeHeader />

      {statsError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{statsError}</AlertDescription>
        </Alert>
      ) : (
        <StatsCards stats={stats} loading={loadingStats} />
      )}

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        {reservationsError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{reservationsError}</AlertDescription>
          </Alert>
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
