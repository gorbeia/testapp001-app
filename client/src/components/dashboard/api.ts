import { authFetch } from '@/lib/api';
import { Language, findMessageByLanguage, MultilingualMessage } from '@shared/schema';

export interface Note {
  id: string;
  title: string;
  content: string;
  isActive: boolean;
  createdBy: string;
  societyId: string;
  createdAt: string;
  updatedAt: string;
  language?: string; // Track the actual language displayed
}

export interface NoteWithMessages extends Note {
  messages: Array<{
    language: string;
    title: string;
    content: string;
  }>;
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

export const fetchNotes = async (language?: string): Promise<Note[]> => {
  try {
    const response = await authFetch('/api/notes');
    if (response.ok) {
      const data: NoteWithMessages[] = await response.json();
      // Get only active notes, sorted by creation date, max 4
      const activeNotes = data
        .filter((note: NoteWithMessages) => note.isActive)
        .sort((a: NoteWithMessages, b: NoteWithMessages) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 4)
        .map(note => {
          // Use provided language or get user's preferred language from localStorage or default to 'eu'
          const userLanguage = (language || (typeof window !== 'undefined' ? localStorage.getItem('language') || 'eu' : 'eu')) as Language;
          
          // Use shared utility for language fallback logic
          const message = findMessageByLanguage(note.messages as MultilingualMessage[], userLanguage);
          
          return {
            ...note,
            title: message?.title || '',
            content: message?.content || '',
            language: message?.language || 'unknown' // Track the actual language displayed
          };
        });
      return activeNotes;
    }
    throw new Error('Failed to fetch notes');
  } catch (error) {
    console.error('Error fetching notes:', error);
    throw error;
  }
};

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
    throw error;
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
    throw new Error('Failed to fetch today reservations count');
  } catch (error) {
    console.error('Error fetching today reservations count:', error);
    throw error;
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
    throw new Error('Failed to fetch today people count');
  } catch (error) {
    console.error('Error fetching today people count:', error);
    throw error;
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
    throw new Error('Failed to fetch today reservations amount');
  } catch (error) {
    console.error('Error fetching today reservations amount:', error);
    throw error;
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
    throw new Error('Failed to fetch monthly consumptions count');
  } catch (error) {
    console.error('Error fetching monthly consumptions count:', error);
    throw error;
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
    throw new Error('Failed to fetch monthly consumptions amount');
  } catch (error) {
    console.error('Error fetching monthly consumptions amount:', error);
    throw error;
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
    throw new Error('Failed to fetch member monthly consumptions amount');
  } catch (error) {
    console.error('Error fetching member monthly consumptions amount:', error);
    throw error;
  }
};

const fetchPendingCreditsSum = async (): Promise<number> => {
  try {
    const response = await authFetch('/api/credits/sum?status=pending');
    if (response.ok) {
      const data = await response.json();
      return data.sum || 0;
    }
    throw new Error('Failed to fetch pending credits sum');
  } catch (error) {
    console.error('Error fetching pending credits sum:', error);
    throw error;
  }
};

const fetchActiveUsersCount = async (): Promise<number> => {
  try {
    const response = await authFetch('/api/users/count?status=active');
    if (response.ok) {
      const data = await response.json();
      return data.count || 0;
    }
    throw new Error('Failed to fetch active users count');
  } catch (error) {
    console.error('Error fetching active users count:', error);
    throw error;
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
    return [];
  } catch (error) {
    console.error('Error fetching upcoming reservations:', error);
    throw error;
  }
};

export const fetchTotalReservationsCount = async (): Promise<number> => {
  try {
    const response = await authFetch('/api/reservations/count?status=confirmed');
    if (response.ok) {
      const data = await response.json();
      return data.count || 0;
    }
    throw new Error('Failed to fetch reservations count');
  } catch (error) {
    console.error('Error fetching reservations count:', error);
    throw error;
  }
};
