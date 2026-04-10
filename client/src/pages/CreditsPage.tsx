import { useEffect, useLayoutEffect, useState } from "react";
import { Redirect } from "wouter";
import { useUrlFilter } from "@/hooks/useUrlFilter";
import { usePagination } from "@/hooks/use-pagination";
import PaginationControls from "@/components/PaginationControls";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, CreditCard, TrendingUp, CheckCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import MonthGrid from "@/components/MonthGrid";
import { TableFiltersBar } from "@/components/TableFiltersBar";
import { useLanguage } from "@/lib/i18n";
import { useFormattedDates } from "@/lib/date-locale";
import { useAuth, userCan } from "@/lib/auth";
import { Permission } from "@shared/permissions";
import { authFetch } from "@/lib/api";
import { readJsonOrThrow } from "@/lib/http-error";
import { AccessDeniedOrError } from "@/components/AccessDeniedOrError";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Credit } from "@shared/schema";

// Extended type for API responses that include memberName and payment tracking
type CreditWithMemberName = Credit & {
  memberName?: string;
  markedByUser?: string;
  markedByUserName?: string;
};

// Helper function to check if credit is for current month
const isCurrentMonth = (monthString: string) => {
  const currentDate = new Date();
  const currentMonthString = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, "0")}`;
  return monthString === currentMonthString;
};

// Helper function to display month in Basque
// const getMonthDisplay = (monthString: string) => {
//   if (!monthString) return "Guztiak";
//   const [year, month] = monthString.split("-");
//   const monthNames = [
//     "Urtarrila",
//     "Otsaila",
//     "Martxoa",
//     "Apirila",
//     "Maiatza",
//     "Ekaina",
//     "Uztaila",
//     "Abuztua",
//     "Iraila",
//     "Urria",
//     "Azaroa",
//     "Abendua",
//   ];
//   return `${monthNames[parseInt(month) - 1]} ${year}`;
// };

// API functions
const fetchCredits = async (filters: {
  month?: string;
  status?: string;
  search?: string;
  page: number;
  limit: number;
}) => {
  const params = new URLSearchParams();
  if (filters.month) params.append("month", filters.month);
  if (filters.status) params.append("status", filters.status);
  if (filters.search?.trim()) params.append("search", filters.search.trim());
  params.set("page", String(filters.page));
  params.set("limit", String(filters.limit));

  const response = await authFetch(`/api/credits?${params}`);
  return readJsonOrThrow<{
    data: CreditWithMemberName[];
    total: number;
    sumPending: number;
    sumPaid: number;
  }>(response);
};

export function CreditsPage() {
  const { t } = useLanguage();
  const { formatDateShort } = useFormattedDates();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const pagination = usePagination({ initialPage: 1, initialLimit: 25 });
  const [selectedCredits, setSelectedCredits] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const [isMarkingAsPaid, setIsMarkingAsPaid] = useState(false);
  const [bouncingId, setBouncingId] = useState<string | null>(null);

  // Use URL filter hook for month and status
  // const currentDate = new Date();
  const monthFilter = useUrlFilter({ baseUrl: "/zorrak", paramName: "month", initialValue: "" });
  const statusFilter = useUrlFilter({
    baseUrl: "/zorrak",
    paramName: "status",
    initialValue: "all",
  });

  useLayoutEffect(() => {
    pagination.setPage(1);
  }, [monthFilter.value, statusFilter.value, debouncedSearch]);

  const isAdmin = userCan(user, Permission.USERS_MANAGE);
  const canTreasurer = userCan(user, Permission.CREDITS_MANAGE);

  const queryClient = useQueryClient();

  const {
    data: societyUser,
    isPending: societyPending,
    isError: societyError,
  } = useQuery({
    queryKey: ["society-user"],
    queryFn: async () => {
      const res = await authFetch("/api/societies/user");
      return readJsonOrThrow<{ sepaMode?: string }>(res);
    },
    enabled: !!user && isAdmin,
    throwOnError: false,
  });

  // Fetch all credits (admin only; monthly-credit UI unused when SEPA is disabled)
  const {
    data: creditsResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "credits",
      monthFilter.value,
      statusFilter.value,
      debouncedSearch,
      pagination.page,
      pagination.limit,
    ],
    queryFn: () =>
      fetchCredits({
        month: monthFilter.value || undefined,
        status: statusFilter.value !== "all" ? statusFilter.value : undefined,
        search: debouncedSearch.trim() || undefined,
        page: pagination.page,
        limit: pagination.limit,
      }),
    enabled:
      !!user &&
      isAdmin &&
      !societyPending &&
      (societyError || societyUser?.sepaMode !== "disabled"),
  });

  useEffect(() => {
    if (creditsResponse && typeof creditsResponse.total === "number") {
      pagination.updatePagination(creditsResponse.total);
    }
  }, [creditsResponse?.total]);

  const credits = creditsResponse?.data ?? [];

  if (societyPending) {
    return <div className="p-6 text-muted-foreground">{t("loading")}</div>;
  }

  if (!societyError && societyUser?.sepaMode === "disabled") {
    return <Redirect to="/mugimenduak" />;
  }

  if (error) {
    return <AccessDeniedOrError error={error} />;
  }

  const totalPending = creditsResponse?.sumPending ?? 0;
  const totalPaid = creditsResponse?.sumPaid ?? 0;

  const pageEligibleForBatch = credits.filter(
    (credit: CreditWithMemberName) => credit.status === "pending" && !isCurrentMonth(credit.month)
  );

  const handleSelectCredit = (creditId: string) => {
    setSelectedCredits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(creditId)) {
        newSet.delete(creditId);
      } else {
        newSet.add(creditId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedCredits.size === pageEligibleForBatch.length && pageEligibleForBatch.length > 0) {
      setSelectedCredits(new Set());
    } else {
      setSelectedCredits(new Set(pageEligibleForBatch.map(c => c.id)));
    }
  };

  const handleMarkAsPaid = async () => {
    if (selectedCredits.size === 0) return;

    setIsMarkingAsPaid(true);
    const countMarked = selectedCredits.size;
    try {
      const response = await authFetch("/api/credits/batch-status", {
        method: "PUT",
        body: JSON.stringify({
          creditIds: Array.from(selectedCredits),
          status: "paid",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to mark credits as paid");
      }

      // Clear selection and refresh data
      setSelectedCredits(new Set());
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({ queryKey: ["account-movements-admin"] });

      toast({
        title: "Eguneratuta",
        description: `${countMarked} zorrak ordaindu gisa markatu dira`,
      });
    } catch (error) {
      console.error("Error marking credits as paid:", error);
      toast({
        title: t("error"),
        description: "Zorrak markatzean errorea gertatu da",
        variant: "destructive",
      });
    } finally {
      setIsMarkingAsPaid(false);
    }
  };

  const handleSepaBounce = async (creditId: string) => {
    if (!window.confirm(t("sepaBounceConfirm"))) return;
    setBouncingId(creditId);
    try {
      const response = await authFetch("/api/account-movements/sepa-bounce", {
        method: "POST",
        body: JSON.stringify({ creditId }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "bounce failed");
      }
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({ queryKey: ["account-movements-admin"] });
      toast({ title: t("success"), description: t("sepaBounce") });
    } catch (e) {
      console.error(e);
      toast({ title: t("error"), variant: "destructive" });
    } finally {
      setBouncingId(null);
    }
  };

  const isAllSelected =
    pageEligibleForBatch.length > 0 &&
    selectedCredits.size === pageEligibleForBatch.length &&
    pageEligibleForBatch.every(c => selectedCredits.has(c.id));

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6" data-testid="credits-page">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" data-testid="credits-page-title">
            {t("allCredits")}
          </h2>
          <p className="text-muted-foreground" data-testid="credits-page-subtitle">
            {t("manageCredits")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleMarkAsPaid}
            disabled={selectedCredits.size === 0 || isMarkingAsPaid}
            data-testid="button-mark-as-paid"
          >
            <Check className="mr-2 h-4 w-4" />
            {isMarkingAsPaid
              ? t("marking")
              : selectedCredits.size === 0
                ? t("selectDebtsToPay")
                : `${t("markAsPaid")} (${selectedCredits.size})`}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-pending">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t("pending")}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="total-pending">
              {totalPending.toFixed(2)}€
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-paid">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t("paid")}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary" data-testid="total-paid">
              {totalPaid.toFixed(2)}€
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-total">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t("total")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-grand">
              {(totalPending + totalPaid).toFixed(2)}€
            </div>
          </CardContent>
        </Card>
      </div>

      <TableFiltersBar>
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`${t("search")}...`}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-credits"
          />
        </div>

        <div className="w-full sm:w-48">
          <MonthGrid
            selectedMonth={monthFilter.value}
            onMonthChange={monthFilter.setValue}
            className="w-full sm:w-48"
            mode="past"
            yearRange={{ past: 3, future: 0 }}
          />
        </div>

        <Select value={statusFilter.value} onValueChange={statusFilter.setValue}>
          <SelectTrigger className="w-full sm:w-40" data-testid="select-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allTime")}</SelectItem>
            <SelectItem value="pending">{t("pending")}</SelectItem>
            <SelectItem value="paid">{t("paid")}</SelectItem>
          </SelectContent>
        </Select>
      </TableFiltersBar>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table data-testid="credits-table">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <div className="flex flex-col gap-1">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      className="rounded"
                      data-testid="checkbox-select-all"
                    />
                    <span className="text-xs font-normal text-muted-foreground max-w-[10rem]">
                      {t("creditsSelectAllPageHint")}
                    </span>
                  </div>
                </TableHead>
                {isAdmin && <TableHead>{t("member")}</TableHead>}
                <TableHead>{t("month")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead className="text-right">{t("status")}</TableHead>
                <TableHead className="text-right">{t("payment")}</TableHead>
                {canTreasurer && <TableHead className="text-right">{t("actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {credits.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? (canTreasurer ? 7 : 6) : canTreasurer ? 6 : 5}
                    className="text-center py-8 text-muted-foreground"
                    data-testid="no-results-message"
                  >
                    {isLoading ? t("loading") : t("noResults")}
                  </TableCell>
                </TableRow>
              ) : (
                credits.map((credit: CreditWithMemberName) => (
                  <TableRow key={credit.id} data-testid={`row-credit-${credit.id}`}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedCredits.has(credit.id)}
                        onChange={() => handleSelectCredit(credit.id)}
                        disabled={credit.status !== "pending" || isCurrentMonth(credit.month)}
                        className="rounded"
                        data-testid={`checkbox-select-${credit.id}`}
                      />
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="font-medium" data-testid={`credit-member-${credit.id}`}>
                        {credit.memberName}
                      </TableCell>
                    )}
                    <TableCell data-testid={`credit-month-${credit.id}`}>{credit.month}</TableCell>
                    <TableCell
                      className="text-right font-medium"
                      data-testid={`credit-amount-${credit.id}`}
                    >
                      {parseFloat(credit.totalAmount || "0").toFixed(2)}€
                    </TableCell>
                    <TableCell className="text-right" data-testid={`credit-status-${credit.id}`}>
                      <Badge variant={credit.status === "paid" ? "default" : "destructive"}>
                        {credit.status === "paid" ? t("paid") : t("pending")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {credit.status === "paid" && credit.markedByUserName && (
                        <div className="space-y-1">
                          <div>{credit.markedByUserName}</div>
                          {credit.markedAsPaidAt && (
                            <div className="text-muted-foreground">
                              {formatDateShort(credit.markedAsPaidAt)}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    {canTreasurer && (
                      <TableCell className="text-right">
                        {credit.status === "paid" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={bouncingId === credit.id}
                            onClick={() => handleSepaBounce(credit.id)}
                            data-testid={`button-sepa-bounce-${credit.id}`}
                          >
                            {t("sepaBounce")}
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <PaginationControls pagination={pagination} itemType="creditsForPagination" />
      </Card>
    </div>
  );
}
