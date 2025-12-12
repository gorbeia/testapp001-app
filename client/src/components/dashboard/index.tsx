import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useState, useEffect } from 'react';
import { Note, fetchNotes, fetchUpcomingReservations, fetchTotalReservationsCount, UpcomingReservation, fetchDashboardStats, DashboardStats } from './api';
import { WelcomeHeader } from './WelcomeHeader';
import { StatsCards } from './StatsCards';
import { UpcomingReservations } from './UpcomingReservations';
import { RecentNotes } from './RecentNotes';


export function Dashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [reservations, setReservations] = useState<UpcomingReservation[]>([]);
  const [totalReservationsCount, setTotalReservationsCount] = useState(0);
  const [loadingReservations, setLoadingReservations] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    todayReservations: 0,
    todayPeople: 0,
    todayReservationsAmount: 0,
    monthlyConsumptions: 0,
    monthlyConsumptionsAmount: 0,
    memberMonthlyConsumptionsAmount: 0,
    pendingCredits: 0,
    activeMembers: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    fetchNotesData();
    fetchReservationsData();
    fetchStatsData();
  }, []);

  const fetchNotesData = async () => {
    setLoadingNotes(true);
    const notesData = await fetchNotes();
    setNotes(notesData);
    setLoadingNotes(false);
  };

  const fetchReservationsData = async () => {
    setLoadingReservations(true);
    const [reservationsData, totalCount] = await Promise.all([
      fetchUpcomingReservations(4),
      fetchTotalReservationsCount()
    ]);
    setReservations(reservationsData);
    setTotalReservationsCount(totalCount);
    setLoadingReservations(false);
  };

  const fetchStatsData = async () => {
    setLoadingStats(true);
    const statsData = await fetchDashboardStats();
    setStats(statsData);
    setLoadingStats(false);
  };

  const eventTypeLabels: Record<string, string> = {
    hamaiketako: t('hamaiketakoa'),
    bazkaria: t('bazkaria'),
    askaria: t('askaria'),
    afaria: t('afaria'),
    urtebetetzea: t('birthday'),
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <WelcomeHeader />

      <StatsCards stats={stats} />

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        <UpcomingReservations 
          reservations={reservations} 
          totalCount={totalReservationsCount}
          eventTypeLabels={eventTypeLabels} 
        />

        <RecentNotes notes={notes} loading={loadingNotes} />
      </div>
    </div>
  );
}
