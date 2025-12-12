import { authFetch } from '@/lib/api';

export interface Note {
  id: string;
  title: string;
  content: string;
  isActive: boolean;
  createdBy: string;
  societyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  todayReservations: number;
  todayPeople: number;
  todayReservationsAmount: number;
  monthlyConsumptions: number;
  monthlyConsumptionsAmount: number;
  memberMonthlyConsumptionsAmount: number;
  pendingCredits: number;
  activeMembers: number;
}

export interface UpcomingReservation {
  id: string;
  member: string;
  date: string;
  time: string;
  type: string;
  table: number;
  guests: number;
}

// Mock data - TODO: replace with real API calls
export const mockStats: DashboardStats = {
  todayReservations: 3,
  todayPeople: 15,
  todayReservationsAmount: 245.00,
  monthlyConsumptions: 245,
  monthlyConsumptionsAmount: 1250.75,
  memberMonthlyConsumptionsAmount: 85.50,
  pendingCredits: 1250.50,
  activeMembers: 48,
};

export const mockUpcomingReservations: UpcomingReservation[] = [
  { id: '1', member: 'Mikel Etxeberria', date: '2024-12-05', time: '13:00', type: 'bazkaria', table: 2, guests: 8 },
  { id: '2', member: 'Ane Zelaia', date: '2024-12-05', time: '21:00', type: 'afaria', table: 1, guests: 12 },
  { id: '3', member: 'Jon Agirre', date: '2024-12-06', time: '11:00', type: 'hamaiketako', table: 3, guests: 6 },
];

export const fetchNotes = async (): Promise<Note[]> => {
  try {
    const response = await authFetch('/api/oharrak');
    if (response.ok) {
      const data = await response.json();
      // Get only active notes, sorted by creation date, max 4
      const activeNotes = data
        .filter((note: Note) => note.isActive)
        .sort((a: Note, b: Note) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 4);
      return activeNotes;
    }
    return [];
  } catch (error) {
    console.error('Error fetching notes:', error);
    return [];
  }
};

// TODO: Add real API functions for stats and reservations
export const fetchDashboardStats = async (): Promise<DashboardStats> => {
  try {
    // Fetch real stats from database
    const [reservationsCount, peopleCount, reservationsAmount, consumptionsCount, consumptionsAmount, memberConsumptionsAmount, creditsSum, usersCount] = await Promise.all([
      fetchTodayReservationsCount(),
      fetchTodayPeopleCount(),
      fetchTodayReservationsAmount(),
      fetchMonthlyConsumptionsCount(),
      fetchMonthlyConsumptionsAmount(),
      fetchMemberMonthlyConsumptionsAmount(),
      fetchPendingCreditsSum(),
      fetchActiveUsersCount()
    ]);

    return {
      todayReservations: reservationsCount,
      todayPeople: peopleCount,
      todayReservationsAmount: reservationsAmount,
      monthlyConsumptions: consumptionsCount,
      monthlyConsumptionsAmount: consumptionsAmount,
      memberMonthlyConsumptionsAmount: memberConsumptionsAmount,
      pendingCredits: creditsSum,
      activeMembers: usersCount,
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return mockStats;
  }
};

const fetchTodayReservationsCount = async (): Promise<number> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const response = await authFetch(`/api/reservations/count?date=${today}`);
    if (response.ok) {
      const data = await response.json();
      return data.count || 0;
    }
    return mockStats.todayReservations;
  } catch (error) {
    console.error('Error fetching today reservations count:', error);
    return mockStats.todayReservations;
  }
};

const fetchTodayPeopleCount = async (): Promise<number> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const response = await authFetch(`/api/reservations/guests-sum?date=${today}`);
    if (response.ok) {
      const data = await response.json();
      return data.guestsSum || 0;
    }
    return mockStats.todayPeople;
  } catch (error) {
    console.error('Error fetching today people count:', error);
    return mockStats.todayPeople;
  }
};

const fetchTodayReservationsAmount = async (): Promise<number> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const response = await authFetch(`/api/reservations/sum?date=${today}`);
    if (response.ok) {
      const data = await response.json();
      return data.sum || 0;
    }
    return mockStats.todayReservationsAmount;
  } catch (error) {
    console.error('Error fetching today reservations amount:', error);
    return mockStats.todayReservationsAmount;
  }
};

const fetchMonthlyConsumptionsCount = async (): Promise<number> => {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const response = await authFetch(`/api/consumptions/count?startDate=${firstDayOfMonth}`);
    if (response.ok) {
      const data = await response.json();
      return data.count || 0;
    }
    return mockStats.monthlyConsumptions;
  } catch (error) {
    console.error('Error fetching monthly consumptions count:', error);
    return mockStats.monthlyConsumptions;
  }
};

const fetchMonthlyConsumptionsAmount = async (): Promise<number> => {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const response = await authFetch(`/api/consumptions/sum?startDate=${firstDayOfMonth}`);
    if (response.ok) {
      const data = await response.json();
      return data.sum || 0;
    }
    return mockStats.monthlyConsumptionsAmount;
  } catch (error) {
    console.error('Error fetching monthly consumptions amount:', error);
    return mockStats.monthlyConsumptionsAmount;
  }
};

const fetchMemberMonthlyConsumptionsAmount = async (): Promise<number> => {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const response = await authFetch(`/api/consumptions/member/sum?startDate=${firstDayOfMonth}`);
    if (response.ok) {
      const data = await response.json();
      return data.sum || 0;
    }
    return mockStats.memberMonthlyConsumptionsAmount;
  } catch (error) {
    console.error('Error fetching member monthly consumptions amount:', error);
    return mockStats.memberMonthlyConsumptionsAmount;
  }
};

const fetchPendingCreditsSum = async (): Promise<number> => {
  try {
    const response = await authFetch('/api/credits/sum?status=pending');
    if (response.ok) {
      const data = await response.json();
      return data.sum || 0;
    }
    return mockStats.pendingCredits;
  } catch (error) {
    console.error('Error fetching pending credits sum:', error);
    return mockStats.pendingCredits;
  }
};

const fetchActiveUsersCount = async (): Promise<number> => {
  try {
    const response = await authFetch('/api/users/count?status=active');
    if (response.ok) {
      const data = await response.json();
      return data.count || 0;
    }
    return mockStats.activeMembers;
  } catch (error) {
    console.error('Error fetching active users count:', error);
    return mockStats.activeMembers;
  }
};

export const fetchUpcomingReservations = async (limit = 4): Promise<UpcomingReservation[]> => {
  try {
    const response = await authFetch(`/api/reservations?limit=${limit}&status=confirmed`);
    if (response.ok) {
      const data = await response.json();
      return data.map((reservation: any) => ({
        id: reservation.id,
        member: reservation.userName || reservation.name || 'Unknown',
        date: reservation.startDate,
        time: new Date(reservation.startDate).toLocaleTimeString('eu-ES', { hour: '2-digit', minute: '2-digit' }),
        type: reservation.type,
        table: reservation.table,
        guests: reservation.guests,
      }));
    }
    return mockUpcomingReservations.slice(0, limit);
  } catch (error) {
    console.error('Error fetching upcoming reservations:', error);
    return mockUpcomingReservations.slice(0, limit);
  }
};

export const fetchTotalReservationsCount = async (): Promise<number> => {
  try {
    const response = await authFetch('/api/reservations/count?status=confirmed');
    if (response.ok) {
      const data = await response.json();
      return data.count || 0;
    }
    return mockUpcomingReservations.length;
  } catch (error) {
    console.error('Error fetching reservations count:', error);
    return mockUpcomingReservations.length;
  }
};
