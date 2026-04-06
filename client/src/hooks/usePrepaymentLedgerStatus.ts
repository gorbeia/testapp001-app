import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/api";

export type PrepaymentLedgerStatus = {
  enforced: boolean;
  floor: number | null;
  balance: number;
  belowFloor: boolean;
};

async function fetchPrepaymentLedgerStatus(): Promise<PrepaymentLedgerStatus> {
  const res = await authFetch("/api/me/prepayment-ledger-status");
  if (!res.ok) {
    return { enforced: false, floor: null, balance: 0, belowFloor: false };
  }
  return res.json() as Promise<PrepaymentLedgerStatus>;
}

export const prepaymentLedgerStatusQueryKey = ["prepayment-ledger-status"] as const;

export function usePrepaymentLedgerStatus() {
  return useQuery({
    queryKey: prepaymentLedgerStatusQueryKey,
    queryFn: fetchPrepaymentLedgerStatus,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
