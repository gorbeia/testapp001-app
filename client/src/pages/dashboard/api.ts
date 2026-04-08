import { authFetch } from "@/lib/api";
import { throwIfResNotOk } from "@/lib/http-error";
import { bcp47Locale, formatDateShort } from "@/lib/date-locale";
import type { Language as UiLanguage } from "@/lib/i18n";
import { Language, findMessageByLanguage, MultilingualMessage } from "@shared/schema";

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
  notifyUsers?: boolean;
}

export interface LowStockSummaryProduct {
  id: string;
  name: string;
  stock: string;
  minStock: string;
  unit: string;
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
  /** When true, subscription billing uses movements balance instead of monthly credit debts UI. */
  sepaModeDisabled: boolean;
  /** Current ledger balance (same as My movements) when `sepaModeDisabled`. */
  memberAccountBalance?: number;
  /** Low-stock catalog rows (staff with product management only; from `GET /api/products/low-stock-summary`). */
  lowStockCount: number;
  lowStockProducts: LowStockSummaryProduct[];
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

/** Row from `/api/credits/member/current` (pending sum uses `totalAmount`). */
interface MemberPendingCreditRow {
  totalAmount: string;
}

/** Raw row from `/api/reservations` list before mapping to `UpcomingReservation`. */
interface ReservationsListApiRow {
  id: string;
  userName?: string;
  name?: string;
  startDate: string;
  type: string;
  table: number;
  guests: number;
}

export const fetchNotes = async (language?: string): Promise<Note[]> => {
  try {
    const response = await authFetch("/api/notes");
    await throwIfResNotOk(response);
    const data: NoteWithMessages[] = await response.json();
    // Get only active notes, sorted by creation date, max 4
    const activeNotes = data
      .filter((note: NoteWithMessages) => note.isActive)
      .sort(
        (a: NoteWithMessages, b: NoteWithMessages) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 4)
      .map(note => {
        // Use provided language or get user's preferred language from localStorage or default to 'eu'
        const userLanguage = (language ||
          (typeof window !== "undefined"
            ? localStorage.getItem("language") || "eu"
            : "eu")) as Language;

        // Use shared utility for language fallback logic
        const message = findMessageByLanguage(
          note.messages as MultilingualMessage[],
          userLanguage
        );

        return {
          ...note,
          title: message?.title || "",
          content: message?.content || "",
          language: message?.language || "unknown", // Track the actual language displayed
        };
      });
    return activeNotes;
  } catch (error) {
    console.error("Error fetching notes:", error);
    throw error;
  }
};

export const fetchDashboardStats = async (): Promise<DashboardStats> => {
  try {
    const societyResPromise = authFetch("/api/societies/user");

    // Fetch basic stats that all users can see
    const [
      reservationsCount,
      peopleCount,
      reservationsAmount,
      consumptionsCount,
      consumptionsAmount,
      memberConsumptionsAmount,
      usersCount,
    ] = await Promise.all([
      fetchTodayReservationsCount(),
      fetchTodayPeopleCount(),
      fetchTodayReservationsAmount(),
      fetchMonthlyConsumptionsCount(),
      fetchMonthlyConsumptionsAmount(),
      fetchMemberMonthlyConsumptionsAmount(),
      fetchActiveUsersCount(),
    ]);

    let sepaModeDisabled = false;
    try {
      const societyRes = await societyResPromise;
      if (societyRes.ok) {
        const s = (await societyRes.json()) as { sepaMode?: string };
        sepaModeDisabled = s?.sepaMode === "disabled";
      }
    } catch (error) {
      console.log("Failed to fetch society for dashboard stats:", error);
    }

    let creditsSum = 0;
    let memberAccountBalance: number | undefined;

    if (sepaModeDisabled) {
      try {
        const mRes = await authFetch("/api/account-movements/me");
        if (mRes.ok) {
          const m = (await mRes.json()) as { balance?: number };
          memberAccountBalance = Number(m.balance ?? 0);
        }
      } catch (error) {
        console.log("Failed to fetch member account balance:", error);
        memberAccountBalance = 0;
      }
    } else {
      try {
        creditsSum = await fetchUserTotalPendingDebt();
      } catch (error) {
        console.log("Failed to fetch user total pending debt:", error);
        creditsSum = 0;
      }
    }

    let lowStockCount = 0;
    let lowStockProducts: LowStockSummaryProduct[] = [];
    try {
      const lowRes = await authFetch("/api/products/low-stock-summary");
      if (lowRes.ok) {
        const data = (await lowRes.json()) as {
          count?: number;
          products?: LowStockSummaryProduct[];
        };
        lowStockCount = data.count ?? 0;
        lowStockProducts = Array.isArray(data.products) ? data.products : [];
      }
    } catch (error) {
      console.log("Low stock summary not loaded:", error);
    }

    return {
      todayReservations: reservationsCount,
      todayPeople: peopleCount,
      todayReservationsAmount: reservationsAmount,
      monthlyConsumptions: consumptionsCount,
      monthlyConsumptionsAmount: consumptionsAmount,
      memberMonthlyConsumptionsAmount: memberConsumptionsAmount,
      pendingCredits: creditsSum,
      activeMembers: usersCount,
      sepaModeDisabled,
      memberAccountBalance: sepaModeDisabled ? (memberAccountBalance ?? 0) : undefined,
      lowStockCount,
      lowStockProducts,
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    throw error;
  }
};

const fetchTodayReservationsCount = async (): Promise<number> => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const response = await authFetch(`/api/reservations/count?date=${today}`);
    await throwIfResNotOk(response);
    const data = await response.json();
    return data.count || 0;
  } catch (error) {
    console.error("Error fetching today reservations count:", error);
    throw error;
  }
};

const fetchTodayPeopleCount = async (): Promise<number> => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const response = await authFetch(`/api/reservations/guests-sum?date=${today}`);
    await throwIfResNotOk(response);
    const data = await response.json();
    return data.guestsSum || 0;
  } catch (error) {
    console.error("Error fetching today people count:", error);
    throw error;
  }
};

const fetchTodayReservationsAmount = async (): Promise<number> => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const response = await authFetch(`/api/reservations/sum?date=${today}`);
    await throwIfResNotOk(response);
    const data = await response.json();
    return data.sum || 0;
  } catch (error) {
    console.error("Error fetching today reservations amount:", error);
    throw error;
  }
};

const fetchMonthlyConsumptionsCount = async (): Promise<number> => {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const response = await authFetch(`/api/consumptions/count?startDate=${firstDayOfMonth}`);
    await throwIfResNotOk(response);
    const data = await response.json();
    return data.count || 0;
  } catch (error) {
    console.error("Error fetching monthly consumptions count:", error);
    throw error;
  }
};

const fetchMonthlyConsumptionsAmount = async (): Promise<number> => {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const response = await authFetch(`/api/consumptions/sum?startDate=${firstDayOfMonth}`);
    await throwIfResNotOk(response);
    const data = await response.json();
    return data.sum || 0;
  } catch (error) {
    console.error("Error fetching monthly consumptions amount:", error);
    throw error;
  }
};

const fetchMemberMonthlyConsumptionsAmount = async (): Promise<number> => {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const response = await authFetch(`/api/consumptions/member/sum?startDate=${firstDayOfMonth}`);
    await throwIfResNotOk(response);
    const data = await response.json();
    return data.sum || 0;
  } catch (error) {
    console.error("Error fetching member monthly consumptions amount:", error);
    throw error;
  }
};

// const fetchPendingCreditsSum = async (): Promise<number> => {
//   try {
//     const response = await authFetch("/api/credits/sum?status=pending");
//     if (response.ok) {
//       const data = await response.json();
//       return data.sum || 0;
//     }
//     throw new Error("Failed to fetch pending credits sum");
//   } catch (error) {
//     console.error("Error fetching pending credits sum:", error);
//     throw error;
//   }
// };

const fetchActiveUsersCount = async (): Promise<number> => {
  try {
    const response = await authFetch("/api/users/count?status=active");
    await throwIfResNotOk(response);
    const data = await response.json();
    return data.count || 0;
  } catch (error) {
    console.error("Error fetching active users count:", error);
    throw error;
  }
};

const fetchUserTotalPendingDebt = async (): Promise<number> => {
  try {
    const response = await authFetch("/api/credits/member/current?status=pending");
    await throwIfResNotOk(response);
    const data = (await response.json()) as MemberPendingCreditRow[];
    return data.reduce(
      (sum: number, credit: MemberPendingCreditRow) =>
        sum + (parseFloat(credit.totalAmount) || 0),
      0
    );
  } catch (error) {
    console.error("Error fetching user total pending debt:", error);
    throw error;
  }
};

export const fetchUpcomingReservations = async (
  limit = 4,
  uiLanguage: UiLanguage = "eu"
): Promise<UpcomingReservation[]> => {
  try {
    const response = await authFetch(
      `/api/reservations?limit=${limit}&status=confirmed&upcoming=true`
    );
    await throwIfResNotOk(response);
    const result = await response.json();
    const data = (result.data || result) as ReservationsListApiRow[];
    const localeTag = bcp47Locale(uiLanguage);
    return data.map(reservation => ({
      id: reservation.id,
      member: reservation.userName || reservation.name || "Unknown",
      date: formatDateShort(reservation.startDate, uiLanguage),
      time: new Date(reservation.startDate).toLocaleTimeString(localeTag, {
        hour: "2-digit",
        minute: "2-digit",
      }),
      type: reservation.type,
      table: reservation.table,
      guests: reservation.guests,
    }));
  } catch (error) {
    console.error("Error fetching upcoming reservations:", error);
    throw error;
  }
};

export const fetchTotalReservationsCount = async (): Promise<number> => {
  try {
    const response = await authFetch("/api/reservations/count?status=confirmed");
    await throwIfResNotOk(response);
    const data = await response.json();
    return data.count || 0;
  } catch (error) {
    console.error("Error fetching reservations count:", error);
    throw error;
  }
};
