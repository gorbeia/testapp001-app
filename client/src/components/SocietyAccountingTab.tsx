import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/lib/i18n";
import { authFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth, userCan } from "@/lib/auth";
import { Permission } from "@shared/permissions";
import MonthGrid from "@/components/MonthGrid";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Pencil, Plus, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { downloadCsv } from "@/lib/csv-export";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { movementTypeLabelKey } from "@/lib/movement-type-label";

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function oneYearAgoMonth(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type SummaryApi = {
  derivedIncome: {
    byType: Array<{ type: string; labelKey: string; total: number }>;
    total: number;
  };
  derivedExpenses: {
    byType: Array<{ type: string; labelKey: string; total: number }>;
    total: number;
  };
  manualIncome: {
    byCategory: Array<{ categoryId: string; name: string; total: number }>;
    total: number;
  };
  manualExpenses: {
    byCategory: Array<{ categoryId: string; name: string; total: number }>;
    total: number;
  };
  adjustmentIncome: number;
  adjustmentExpense: number;
  grandTotalIncome: number;
  grandTotalExpenses: number;
  net: number;
};

type CategoryRow = {
  id: string;
  name: string;
  nameEs: string | null;
  type: string;
  sortOrder: number;
  isActive: boolean;
};

function formatMoney(n: number): string {
  return `${n.toFixed(2)}€`;
}

function balanceAmountClass(b: number) {
  if (b < 0) return "text-destructive";
  if (b > 0) return "text-green-600";
  return "text-muted-foreground";
}

export function SocietyAccountingTab() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const canManage = userCan(user, Permission.SOCIETY_TRANSACTIONS_MANAGE);
  const queryClient = useQueryClient();

  const [from, setFrom] = React.useState(oneYearAgoMonth);
  const [to, setTo] = React.useState(currentYearMonth);

  const [entryOpen, setEntryOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [entryCategoryId, setEntryCategoryId] = React.useState("");
  const [entryAmount, setEntryAmount] = React.useState("");
  const [entryDate, setEntryDate] = React.useState("");
  const [entryDescription, setEntryDescription] = React.useState("");

  const [categoryOpen, setCategoryOpen] = React.useState(false);
  const [newCatName, setNewCatName] = React.useState("");
  const [newCatNameEs, setNewCatNameEs] = React.useState("");
  const [newCatType, setNewCatType] = React.useState<"income" | "expense">("expense");

  const derivedMovementsQuery = useQuery({
    queryKey: ["society-accounting-derived-movements", from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      const res = await authFetch(`/api/society-accounting/derived-movements?${params}`);
      if (!res.ok) throw new Error("derived-movements");
      return res.json() as Promise<{
        movements: Array<{
          source: "ledger" | "manual" | "adjustment";
          id: string;
          userId: string | null;
          type: string;
          categoryId: string | null;
          categoryName: string | null;
          categoryType: "income" | "expense" | null;
          amount: string;
          description: string | null;
          createdAt: string;
          memberName: string | null;
          memberUsername: string | null;
          societyBalance: number;
          bookingDate: string | null;
        }>;
      }>;
    },
  });

  const summaryQuery = useQuery({
    queryKey: ["society-accounting-summary", from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      const res = await authFetch(`/api/society-accounting/summary?${params}`);
      if (!res.ok) throw new Error("summary");
      return res.json() as Promise<SummaryApi>;
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ["society-transaction-categories"],
    queryFn: async () => {
      const res = await authFetch("/api/society-transaction-categories");
      if (!res.ok) throw new Error("categories");
      return res.json() as Promise<CategoryRow[]>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: {
      categoryId: string;
      date: string;
      amount: number;
      description?: string;
    }) => {
      const res = await authFetch("/api/society-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["society-accounting-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["society-accounting-derived-movements"] });
      setEntryOpen(false);
      resetEntryForm();
      toast({ title: t("success"), description: t("societyAccountingEntrySaved") });
    },
    onError: () => {
      toast({
        title: t("error"),
        description: t("societyAccountingEntrySaveFailed"),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; body: Record<string, unknown> }) => {
      const res = await authFetch(`/api/society-transactions/${payload.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["society-accounting-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["society-accounting-derived-movements"] });
      setEntryOpen(false);
      setEditingId(null);
      resetEntryForm();
      toast({ title: t("success"), description: t("societyAccountingEntrySaved") });
    },
    onError: () => {
      toast({
        title: t("error"),
        description: t("societyAccountingEntrySaveFailed"),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/society-transactions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["society-accounting-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["society-accounting-derived-movements"] });
      toast({ title: t("success"), description: t("societyAccountingEntryDeleted") });
    },
    onError: () => {
      toast({
        title: t("error"),
        description: t("societyAccountingEntryDeleteFailed"),
        variant: "destructive",
      });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (body: { name: string; nameEs?: string; type: "income" | "expense" }) => {
      const res = await authFetch("/api/society-transaction-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["society-transaction-categories"] });
      void queryClient.invalidateQueries({ queryKey: ["society-accounting-summary"] });
      setNewCatName("");
      setNewCatNameEs("");
      toast({ title: t("success"), description: t("societyAccountingCategoryCreated") });
    },
    onError: () => {
      toast({
        title: t("error"),
        description: t("societyAccountingCategoryCreateFailed"),
        variant: "destructive",
      });
    },
  });

  function resetEntryForm() {
    setEditingId(null);
    setEntryCategoryId("");
    setEntryAmount("");
    setEntryDate(new Date().toISOString().slice(0, 10));
    setEntryDescription("");
  }

  React.useEffect(() => {
    if (entryOpen && !editingId) {
      setEntryDate(prev => prev || new Date().toISOString().slice(0, 10));
    }
  }, [entryOpen, editingId]);

  const openNewEntry = () => {
    resetEntryForm();
    setEntryOpen(true);
  };

  const openEditManualMovement = (row: {
    id: string;
    categoryId: string | null;
    amount: string;
    bookingDate: string | null;
    description: string | null;
  }) => {
    if (!row.categoryId || !row.bookingDate) return;
    setEditingId(row.id);
    setEntryCategoryId(row.categoryId);
    setEntryAmount(parseFloat(row.amount).toFixed(2));
    setEntryDate(row.bookingDate.slice(0, 10));
    setEntryDescription(row.description ?? "");
    setEntryOpen(true);
  };

  const submitEntry = () => {
    const amount = parseFloat(entryAmount.replace(",", "."));
    if (!entryCategoryId || !Number.isFinite(amount) || amount <= 0 || !entryDate) return;
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        body: {
          categoryId: entryCategoryId,
          date: entryDate,
          amount,
          description: entryDescription || undefined,
        },
      });
    } else {
      createMutation.mutate({
        categoryId: entryCategoryId,
        date: entryDate,
        amount,
        description: entryDescription || undefined,
      });
    }
  };

  const downloadSummaryCsv = () => {
    const s = summaryQuery.data;
    if (!s) return;
    const sep = language === "es" ? ";" : ";";
    const header = ["section", "source", "total"];
    const lines: string[][] = [header];
    for (const r of s.derivedIncome.byType) {
      lines.push(["income", t(r.labelKey as never), r.total.toFixed(2)]);
    }
    for (const r of s.manualIncome.byCategory) {
      lines.push(["income", r.name, r.total.toFixed(2)]);
    }
    for (const r of s.derivedExpenses.byType) {
      lines.push(["expense", t(r.labelKey as never), r.total.toFixed(2)]);
    }
    for (const r of s.manualExpenses.byCategory) {
      lines.push(["expense", r.name, r.total.toFixed(2)]);
    }
    if ((s.adjustmentIncome ?? 0) > 0) {
      lines.push(["income", t("societyAccountingAdjustmentIncome"), s.adjustmentIncome.toFixed(2)]);
    }
    if ((s.adjustmentExpense ?? 0) > 0) {
      lines.push([
        "expense",
        t("societyAccountingAdjustmentExpense"),
        s.adjustmentExpense.toFixed(2),
      ]);
    }
    lines.push(["", t("grandTotalIncome"), s.grandTotalIncome.toFixed(2)]);
    lines.push(["", t("grandTotalExpenses"), s.grandTotalExpenses.toFixed(2)]);
    lines.push(["", t("netBalance"), s.net.toFixed(2)]);
    const csv =
      "\uFEFF" +
      lines.map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(sep)).join("\n");
    downloadCsv(csv, `kontabilitatea-${from}-${to}.csv`);
    toast({ title: t("success"), description: t("societyAccountingCsvSuccess") });
  };

  const s = summaryQuery.data;
  const expenseCategories =
    categoriesQuery.data?.filter(c => c.type === "expense" && c.isActive) ?? [];
  const incomeCategories =
    categoriesQuery.data?.filter(c => c.type === "income" && c.isActive) ?? [];

  return (
    <div className="space-y-4" data-testid="society-accounting-panel">
      <h2 className="text-xl font-semibold">{t("societyAccounting")}</h2>

      <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
        <div className="space-y-2">
          <Label className="text-xs">{t("ledgerStatementFromMonth")}</Label>
          <MonthGrid
            selectedMonth={from}
            onMonthChange={setFrom}
            className="w-full"
            mode="past"
            yearRange={{ past: 5, future: 0 }}
            triggerTestId="accounting-period-from-month"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">{t("ledgerStatementToMonth")}</Label>
          <MonthGrid
            selectedMonth={to}
            onMonthChange={setTo}
            className="w-full"
            mode="past"
            yearRange={{ past: 5, future: 0 }}
            triggerTestId="accounting-period-to-month"
          />
        </div>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="mb-2 flex-wrap h-auto gap-1">
          <TabsTrigger value="summary" data-testid="society-accounting-tab-summary">
            {t("societyAccountingTabSummary")}
          </TabsTrigger>
          <TabsTrigger
            value="derived-movements"
            data-testid="society-accounting-tab-derived-movements"
          >
            {t("societyAccountingTabDerivedMovements")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4 mt-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-xl">{t("derivedFromMembersHint")}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="accounting-download-csv"
          onClick={() => downloadSummaryCsv()}
          disabled={!s}
        >
          <Download className="h-4 w-4 mr-2" />
          {t("downloadCsv")}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("income")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div
              className="text-2xl font-bold text-green-600"
              data-testid="accounting-stat-income"
            >
              {summaryQuery.isLoading ? "…" : formatMoney(s?.grandTotalIncome ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("expenses")}</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div
              className="text-2xl font-bold text-destructive"
              data-testid="accounting-stat-expenses"
            >
              {summaryQuery.isLoading ? "…" : formatMoney(s?.grandTotalExpenses ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("netBalance")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${(s?.net ?? 0) >= 0 ? "text-green-600" : "text-destructive"}`}
              data-testid="accounting-stat-net"
            >
              {summaryQuery.isLoading ? "…" : formatMoney(s?.net ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("annualSummary")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table data-testid="accounting-summary-table">
            <TableHeader>
              <TableRow>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{t("category")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!s || summaryQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    …
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {s.derivedIncome.byType.map(r => (
                    <TableRow key={`d-i-${r.type}`}>
                      <TableCell>
                        <span className="text-xs rounded bg-green-100 text-green-800 px-2 py-0.5 dark:bg-green-900/40 dark:text-green-300">
                          {t("income")}
                        </span>
                      </TableCell>
                      <TableCell>{t(r.labelKey as never)}</TableCell>
                      <TableCell className="text-right">{formatMoney(r.total)}</TableCell>
                    </TableRow>
                  ))}
                  {s.manualIncome.byCategory.map(r => (
                    <TableRow key={`m-i-${r.categoryId}`}>
                      <TableCell>
                        <span className="text-xs rounded bg-green-100 text-green-800 px-2 py-0.5 dark:bg-green-900/40 dark:text-green-300">
                          {t("income")}
                        </span>
                      </TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right">{formatMoney(r.total)}</TableCell>
                    </TableRow>
                  ))}
                  {s.derivedExpenses.byType.map(r => (
                    <TableRow key={`d-e-${r.type}`}>
                      <TableCell>
                        <span className="text-xs rounded bg-red-100 text-red-800 px-2 py-0.5 dark:bg-red-900/40 dark:text-red-300">
                          {t("expenses")}
                        </span>
                      </TableCell>
                      <TableCell>{t(r.labelKey as never)}</TableCell>
                      <TableCell className="text-right">{formatMoney(r.total)}</TableCell>
                    </TableRow>
                  ))}
                  {s.manualExpenses.byCategory.map(r => (
                    <TableRow key={`m-e-${r.categoryId}`}>
                      <TableCell>
                        <span className="text-xs rounded bg-red-100 text-red-800 px-2 py-0.5 dark:bg-red-900/40 dark:text-red-300">
                          {t("expenses")}
                        </span>
                      </TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right">{formatMoney(r.total)}</TableCell>
                    </TableRow>
                  ))}
                  {(s.adjustmentIncome ?? 0) > 0 && (
                    <TableRow key="adj-income">
                      <TableCell>
                        <span className="text-xs rounded bg-green-100 text-green-800 px-2 py-0.5 dark:bg-green-900/40 dark:text-green-300">
                          {t("income")}
                        </span>
                      </TableCell>
                      <TableCell>{t("societyAccountingAdjustmentIncome")}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(s.adjustmentIncome)}
                      </TableCell>
                    </TableRow>
                  )}
                  {(s.adjustmentExpense ?? 0) > 0 && (
                    <TableRow key="adj-expense">
                      <TableCell>
                        <span className="text-xs rounded bg-red-100 text-red-800 px-2 py-0.5 dark:bg-red-900/40 dark:text-red-300">
                          {t("expenses")}
                        </span>
                      </TableCell>
                      <TableCell>{t("societyAccountingAdjustmentExpense")}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(s.adjustmentExpense)}
                      </TableCell>
                    </TableRow>
                  )}
                  {s.derivedIncome.byType.length === 0 &&
                    s.manualIncome.byCategory.length === 0 &&
                    s.derivedExpenses.byType.length === 0 &&
                    s.manualExpenses.byCategory.length === 0 &&
                    (s.adjustmentIncome ?? 0) <= 0 &&
                    (s.adjustmentExpense ?? 0) <= 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          {t("noResults")}
                        </TableCell>
                      </TableRow>
                    )}
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canManage && (
        <Collapsible open={categoryOpen} onOpenChange={setCategoryOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-between">
              {t("categoryManagement")}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-4 border rounded-md p-4">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">{t("name")}</Label>
                <Input
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  data-testid="input-new-category-name-eu"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("categoryNameEs")}</Label>
                <Input
                  value={newCatNameEs}
                  onChange={e => setNewCatNameEs(e.target.value)}
                  data-testid="input-new-category-name-es"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("type")}</Label>
                <Select
                  value={newCatType}
                  onValueChange={v => setNewCatType(v as "income" | "expense")}
                >
                  <SelectTrigger data-testid="select-new-category-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">{t("expenses")}</SelectItem>
                    <SelectItem value="income">{t("income")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  data-testid="button-save-new-category"
                  disabled={!newCatName.trim() || createCategoryMutation.isPending}
                  onClick={() =>
                    createCategoryMutation.mutate({
                      name: newCatName.trim(),
                      nameEs: newCatNameEs.trim() || undefined,
                      type: newCatType,
                    })
                  }
                >
                  {t("create")} {t("category")}
                </Button>
              </div>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              {(categoriesQuery.data ?? []).map(c => (
                <li key={c.id}>
                  {c.name} ({c.type === "income" ? t("income") : t("expenses")})
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
        </TabsContent>

        <TabsContent value="derived-movements" className="space-y-4 mt-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2 max-w-3xl">
              <p className="text-sm text-muted-foreground">
                {t("societyAccountingDerivedMovementsHint")}
              </p>
              <p className="text-sm text-muted-foreground">{t("movementsSignLegend")}</p>
              <p className="text-sm text-muted-foreground">
                {t("societyAccountingManualInMovementsHint")}
              </p>
            </div>
            {canManage && (
              <Button
                type="button"
                size="sm"
                className="shrink-0"
                data-testid="add-manual-entry-button"
                onClick={() => openNewEntry()}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("addManualEntry")}
              </Button>
            )}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{t("movementListSection")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table data-testid="society-accounting-derived-movements-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("member")}</TableHead>
                    <TableHead>{t("movementType")}</TableHead>
                    <TableHead className="text-right">{t("amount")}</TableHead>
                    <TableHead className="text-right">{t("societyAccountingBalance")}</TableHead>
                    <TableHead>{t("title")}</TableHead>
                    {canManage && <TableHead className="w-24">{t("actions")}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(derivedMovementsQuery.data?.movements ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={canManage ? 7 : 6}
                        className="text-center text-muted-foreground"
                      >
                        {derivedMovementsQuery.isLoading ? "…" : t("noMovements")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    derivedMovementsQuery.data!.movements.map(m => (
                      <TableRow
                        key={`${m.source}-${m.id}`}
                        data-testid={`society-accounting-derived-row-${m.source}-${m.id}`}
                      >
                        <TableCell>
                          {(m.source === "manual" || m.source === "adjustment") && m.bookingDate
                            ? new Date(`${m.bookingDate}T12:00:00`).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "numeric",
                                day: "numeric",
                              })
                            : new Date(m.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {m.source === "manual"
                            ? t("manualEntries")
                            : m.source === "adjustment"
                              ? t("societyAccountingMovementsAdjustmentSource")
                              : (m.memberName ?? m.memberUsername ?? m.userId ?? "—")}
                        </TableCell>
                        <TableCell>
                          {(m.source === "manual" ||
                            (m.source === "adjustment" && m.categoryName)) &&
                          m.categoryName ? (
                            <span className="flex flex-col gap-0.5">
                              <span>{m.categoryName}</span>
                              <span className="text-xs text-muted-foreground">
                                {m.categoryType === "income" ? t("income") : t("expenses")}
                              </span>
                            </span>
                          ) : (
                            t(movementTypeLabelKey(m.type))
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {parseFloat(m.amount).toFixed(2)}€
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${balanceAmountClass(m.societyBalance)}`}
                          data-testid={`society-accounting-derived-balance-${m.source}-${m.id}`}
                        >
                          {m.societyBalance.toFixed(2)}€
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{m.description ?? "—"}</TableCell>
                        {canManage && (
                          <TableCell>
                            {m.source === "manual" ? (
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={t("edit")}
                                  onClick={() => openEditManualMovement(m)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={t("delete")}
                                  data-testid={`manual-entry-delete-${m.id}`}
                                  onClick={() => {
                                    if (window.confirm(t("societyAccountingConfirmDeleteEntry"))) {
                                      deleteMutation.mutate(m.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            ) : null}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={entryOpen}
        onOpenChange={o => {
          if (!o) {
            setEntryOpen(false);
            resetEntryForm();
          }
        }}
      >
        <DialogContent data-testid="dialog-manual-entry">
          <DialogHeader>
            <DialogTitle>{editingId ? t("edit") : t("addManualEntry")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t("category")}</Label>
              <Select value={entryCategoryId} onValueChange={setEntryCategoryId}>
                <SelectTrigger data-testid="select-manual-entry-category">
                  <SelectValue placeholder={t("selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent
                  className="max-h-[min(18rem,var(--radix-select-content-available-height))] z-[120]"
                  position="popper"
                >
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    {t("expenses")}
                  </div>
                  {expenseCategories.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {language === "es" && c.nameEs ? c.nameEs : c.name}
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-t mt-1">
                    {t("income")}
                  </div>
                  {incomeCategories.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {language === "es" && c.nameEs ? c.nameEs : c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("amount")}</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={entryAmount}
                onChange={e => setEntryAmount(e.target.value)}
                data-testid="input-manual-entry-amount"
              />
            </div>
            <div className="space-y-1">
              <Label>{t("date")}</Label>
              <Input
                type="date"
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
                data-testid="input-manual-entry-date"
              />
            </div>
            <div className="space-y-1">
              <Label>{t("title")}</Label>
              <Textarea
                value={entryDescription}
                onChange={e => setEntryDescription(e.target.value)}
                data-testid="input-manual-entry-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEntryOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              data-testid="button-submit-manual-entry"
              disabled={
                !entryCategoryId ||
                !entryAmount ||
                !entryDate ||
                createMutation.isPending ||
                updateMutation.isPending
              }
              onClick={() => submitEntry()}
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
