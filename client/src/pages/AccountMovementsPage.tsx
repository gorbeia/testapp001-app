import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useUrlFilter } from "@/hooks/useUrlFilter";
import { useLanguage } from "@/lib/i18n";
import { formatDateTime } from "@/lib/date-locale";
import { authFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { downloadCsv } from "@/lib/csv-export";
import {
  buildAccountStatementCsv,
  buildMemberBalancesCsv,
  buildSocietyStatementCsv,
  type AccountStatementApi,
  type MemberBalancesApi,
  type SocietyStatementApi,
} from "@/lib/ledger-report-csv";

const STATEMENT_ALL_MEMBERS = "__all__";
import MonthGrid from "@/components/MonthGrid";
import { TableFiltersBar, TableFilterField } from "@/components/TableFiltersBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { movementTypeLabelKey } from "@/lib/movement-type-label";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { List, Scale, Wallet, Download } from "lucide-react";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/use-pagination";

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function oneYearAgoMonth(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MOVEMENT_TYPES = [
  "all",
  "consumption",
  "reservation",
  "subscription",
  "sepa_collection",
  "sepa_bounce",
  "bank_transfer",
  "refund",
  "adjustment",
  "cash_payment",
] as const;

type UserRow = { id: string; name: string | null; username: string };

function balanceAmountClass(b: number) {
  if (b < 0) return "text-destructive";
  if (b > 0) return "text-green-600";
  return "text-muted-foreground";
}

export function AccountMovementsPage() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [statementOpen, setStatementOpen] = React.useState(false);
  const [statementMemberId, setStatementMemberId] = React.useState("");
  const [statementFrom, setStatementFrom] = React.useState("");
  const [statementTo, setStatementTo] = React.useState("");
  const [statementBusy, setStatementBusy] = React.useState(false);
  const [balancesBusy, setBalancesBusy] = React.useState(false);
  const monthFilter = useUrlFilter({
    baseUrl: "/mugimenduak",
    paramName: "month",
    initialValue: "",
  });
  const [type, setType] = React.useState<string>("all");
  const [userId, setUserId] = React.useState<string>("all");
  const month = monthFilter.value;
  const pagination = usePagination({ initialPage: 1, initialLimit: 25 });

  React.useLayoutEffect(() => {
    pagination.setPage(1);
  }, [month, type, userId]);

  const usersQuery = useQuery({
    queryKey: ["users-for-movements"],
    queryFn: async () => {
      const res = await authFetch("/api/users");
      if (!res.ok) throw new Error("users");
      return res.json() as Promise<UserRow[]>;
    },
  });

  const query = useQuery({
    queryKey: ["account-movements-admin", month, type, userId, pagination.page, pagination.limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (month) params.set("month", month);
      if (type !== "all") params.set("type", type);
      if (userId !== "all") params.set("userId", userId);
      params.set("page", String(pagination.page));
      params.set("limit", String(pagination.limit));
      const res = await authFetch(`/api/account-movements?${params}`);
      if (!res.ok) throw new Error("movements");
      return res.json() as Promise<{
        movements: Array<{
          id: string;
          userId: string;
          type: string;
          amount: string;
          description: string | null;
          createdAt: string;
          runningBalance: number;
          memberName: string | null;
        }>;
        total: number;
        sumAmount: number;
        selectedMemberBalance: number | null;
      }>;
    },
  });

  React.useEffect(() => {
    if (query.data && typeof query.data.total === "number") {
      pagination.updatePagination(query.data.total);
    }
  }, [query.data?.total]);

  const selBal = query.data?.selectedMemberBalance;
  const memberBalanceStatusKey =
    userId === "all" || selBal === undefined || selBal === null
      ? null
      : selBal < 0
        ? "balanceStatusOwed"
        : selBal > 0
          ? "balanceStatusCredit"
          : "balanceStatusZero";

  const downloadMemberBalancesCsv = async () => {
    setBalancesBusy(true);
    try {
      const params = new URLSearchParams();
      if (month) params.set("month", month);
      const res = await authFetch(`/api/account-movements/balances?${params}`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as MemberBalancesApi;
      const csv = buildMemberBalancesCsv(t, data);
      const slug = month || "all-months";
      downloadCsv(csv, `member-balances-${slug}.csv`);
      toast({ title: t("success"), description: t("ledgerBalancesExportSuccess") });
    } catch {
      toast({
        title: t("error"),
        description: t("ledgerBalancesExportFailed"),
        variant: "destructive",
      });
    } finally {
      setBalancesBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4" data-testid="admin-movements-page">
      <Dialog open={statementOpen} onOpenChange={setStatementOpen}>
        <DialogContent data-testid="dialog-admin-ledger-statement-csv">
          <DialogHeader>
            <DialogTitle>{t("ledgerStatementDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">{t("ledgerStatementSelectMember")}</Label>
              <Select value={statementMemberId} onValueChange={setStatementMemberId}>
                <SelectTrigger className="w-full" data-testid="select-statement-export-member">
                  <SelectValue placeholder={t("selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent className="z-[120]" position="popper">
                  <SelectItem value={STATEMENT_ALL_MEMBERS}>
                    {t("ledgerSocietyStatementAll")}
                  </SelectItem>
                  {(usersQuery.data ?? []).map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("ledgerStatementFromMonth")}</p>
                <MonthGrid
                  selectedMonth={statementFrom}
                  onMonthChange={setStatementFrom}
                  className="w-full"
                  mode="past"
                  yearRange={{ past: 3, future: 0 }}
                  nestedInDialog
                  allowClear={false}
                  triggerTestId="admin-statement-dialog-from-month"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("ledgerStatementToMonth")}</p>
                <MonthGrid
                  selectedMonth={statementTo}
                  onMonthChange={setStatementTo}
                  className="w-full"
                  mode="past"
                  yearRange={{ past: 3, future: 0 }}
                  nestedInDialog
                  allowClear={false}
                  triggerTestId="admin-statement-dialog-to-month"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStatementOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              disabled={
                statementBusy ||
                !statementMemberId ||
                !statementFrom ||
                !statementTo ||
                statementFrom > statementTo
              }
              data-testid="button-confirm-admin-statement-csv"
              onClick={async () => {
                if (
                  !statementMemberId ||
                  !statementFrom ||
                  !statementTo ||
                  statementFrom > statementTo
                )
                  return;
                setStatementBusy(true);
                try {
                  if (statementMemberId === STATEMENT_ALL_MEMBERS) {
                    const params = new URLSearchParams({
                      from: statementFrom,
                      to: statementTo,
                    });
                    const res = await authFetch(
                      `/api/account-movements/society-statement?${params}`
                    );
                    if (!res.ok) throw new Error(await res.text());
                    const data = (await res.json()) as SocietyStatementApi;
                    const csv = buildSocietyStatementCsv(t, data, language);
                    downloadCsv(csv, `society-statement-${statementFrom}-${statementTo}.csv`);
                  } else {
                    const params = new URLSearchParams({
                      userId: statementMemberId,
                      from: statementFrom,
                      to: statementTo,
                    });
                    const res = await authFetch(`/api/account-movements/statement?${params}`);
                    if (!res.ok) throw new Error(await res.text());
                    const data = (await res.json()) as AccountStatementApi;
                    const csv = buildAccountStatementCsv(t, data, language);
                    const memberSlug = data.member.username.replace(/[^a-zA-Z0-9._-]/g, "_");
                    downloadCsv(csv, `statement-${memberSlug}-${statementFrom}-${statementTo}.csv`);
                  }
                  toast({ title: t("success"), description: t("ledgerStatementExportSuccess") });
                  setStatementOpen(false);
                } catch {
                  toast({
                    title: t("error"),
                    description: t("ledgerStatementExportFailed"),
                    variant: "destructive",
                  });
                } finally {
                  setStatementBusy(false);
                }
              }}
            >
              {statementBusy ? t("loading") : t("ledgerStatementDownload")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold" data-testid="admin-movements-title">
          {t("adminMovements")}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={balancesBusy}
            data-testid="button-download-member-balances-csv"
            onClick={() => void downloadMemberBalancesCsv()}
          >
            <Download className="h-4 w-4 mr-2" />
            {t("ledgerBalancesExport")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="button-download-admin-statement-csv"
            onClick={() => {
              setStatementFrom(oneYearAgoMonth());
              setStatementTo(month || currentYearMonth());
              setStatementMemberId(userId !== "all" ? userId : STATEMENT_ALL_MEMBERS);
              setStatementOpen(true);
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            {t("ledgerStatementDownload")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-admin-movements-count">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("movementsStatsFilteredCount")}
            </CardTitle>
            <List className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="admin-movements-count">
              {query.isLoading ? "…" : (query.data?.total ?? 0)}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-admin-movements-net">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t("movementsStatsFilteredNet")}</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                query.isLoading ? "" : balanceAmountClass(query.data?.sumAmount ?? 0)
              }`}
              data-testid="admin-movements-sum-amount"
            >
              {query.isLoading ? "…" : `${(query.data?.sumAmount ?? 0).toFixed(2)}€`}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-admin-movements-member-balance">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t("memberLedgerBalanceStat")}</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {userId === "all" ? (
              <p
                className="text-sm text-muted-foreground"
                data-testid="admin-movements-member-balance-placeholder"
              >
                {t("selectMemberToSeeBalance")}
              </p>
            ) : (
              <>
                <div
                  className={`text-2xl font-bold ${
                    query.isLoading || selBal === undefined || selBal === null
                      ? ""
                      : balanceAmountClass(selBal)
                  }`}
                  data-testid="admin-movements-member-balance-value"
                >
                  {query.isLoading || selBal === undefined || selBal === null
                    ? "…"
                    : `${selBal.toFixed(2)}€`}
                </div>
                {memberBalanceStatusKey && (
                  <p className="text-xs text-muted-foreground mt-2">{t(memberBalanceStatusKey)}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <TableFiltersBar>
        <TableFilterField label={t("month")} className="w-full sm:w-48">
          <div data-testid="admin-filter-month">
            <MonthGrid
              selectedMonth={monthFilter.value}
              onMonthChange={monthFilter.setValue}
              className="w-full"
              mode="past"
              yearRange={{ past: 3, future: 0 }}
            />
          </div>
        </TableFilterField>
        <TableFilterField label={t("movementType")}>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-48" data-testid="admin-filter-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MOVEMENT_TYPES.map(mt => (
                <SelectItem key={mt} value={mt}>
                  {mt === "all" ? t("movementTypesAll") : t(movementTypeLabelKey(mt))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableFilterField>
        <TableFilterField label={t("filterByMember")}>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="w-56" data-testid="admin-filter-user">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all")}</SelectItem>
              {(usersQuery.data ?? []).map(u => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name || u.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableFilterField>
      </TableFiltersBar>

      <Card>
        <CardHeader>
          <CardTitle>{t("movementListSection")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className="text-sm text-muted-foreground mb-3"
            data-testid="admin-movements-sign-legend"
          >
            {t("movementsSignLegend")}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("member")}</TableHead>
                <TableHead>{t("movementType")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead className="text-right">{t("runningBalance")}</TableHead>
                <TableHead>{t("title")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(query.data?.movements ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {query.isLoading ? "…" : t("noMovements")}
                  </TableCell>
                </TableRow>
              ) : (
                query.data!.movements.map(m => (
                  <TableRow key={m.id} data-testid={`admin-movement-row-${m.id}`}>
                    <TableCell>{formatDateTime(m.createdAt, language)}</TableCell>
                    <TableCell data-testid={`admin-movement-member-${m.id}`}>
                      {m.memberName ?? m.userId}
                    </TableCell>
                    <TableCell>{t(movementTypeLabelKey(m.type))}</TableCell>
                    <TableCell className="text-right">{parseFloat(m.amount).toFixed(2)}€</TableCell>
                    <TableCell className="text-right">{m.runningBalance.toFixed(2)}€</TableCell>
                    <TableCell className="max-w-xs truncate">{m.description ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <PaginationControls pagination={pagination} itemType="movementsForPagination" />
        </CardContent>
      </Card>
    </div>
  );
}
