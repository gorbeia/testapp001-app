import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUrlFilter } from "@/hooks/useUrlFilter";
import { useLanguage } from "@/lib/i18n";
import { authFetch } from "@/lib/api";
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
import { movementTypeLabelKey } from "@/lib/movement-type-label";

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
] as const;

export function MyMovementsPage() {
  const { t } = useLanguage();
  const monthFilter = useUrlFilter({
    baseUrl: "/nire-mugimenduak",
    paramName: "month",
    initialValue: "",
  });
  const [type, setType] = useState<string>("all");
  const month = monthFilter.value;

  const query = useQuery({
    queryKey: ["account-movements-me", month, type],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (month) params.set("month", month);
      if (type !== "all") params.set("type", type);
      const res = await authFetch(`/api/account-movements/me?${params}`);
      if (!res.ok) throw new Error("Failed to load movements");
      return res.json() as Promise<{
        balance: number;
        movements: Array<{
          id: string;
          type: string;
          amount: string;
          description: string | null;
          createdAt: string;
          runningBalance: number;
        }>;
      }>;
    },
  });

  return (
    <div className="p-4 sm:p-6 space-y-4" data-testid="my-movements-page">
      <h1 className="text-2xl font-bold" data-testid="my-movements-title">
        {t("myMovements")}
      </h1>

      <div className="flex flex-wrap gap-4">
        <div className="w-full sm:w-48" data-testid="filter-month-movements">
          <MonthGrid
            selectedMonth={monthFilter.value}
            onMonthChange={monthFilter.setValue}
            className="w-full sm:w-48"
            mode="past"
            yearRange={{ past: 3, future: 0 }}
          />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-48" data-testid="select-movement-type">
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle data-testid="my-balance-label">
            {t("currentBalance")}:{" "}
            <span data-testid="my-balance-value">
              {(query.data?.balance ?? 0).toFixed(2)}€
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("movementType")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead className="text-right">{t("runningBalance")}</TableHead>
                <TableHead>{t("title")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(query.data?.movements ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {query.isLoading ? "…" : t("noMovements")}
                  </TableCell>
                </TableRow>
              ) : (
                query.data!.movements.map(m => (
                  <TableRow key={m.id} data-testid={`movement-row-${m.id}`}>
                    <TableCell data-testid={`movement-date-${m.id}`}>
                      {new Date(m.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell data-testid={`movement-type-${m.id}`}>
                      {t(movementTypeLabelKey(m.type))}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      data-testid={`movement-amount-${m.id}`}
                    >
                      {parseFloat(m.amount).toFixed(2)}€
                    </TableCell>
                    <TableCell
                      className="text-right"
                      data-testid={`movement-running-${m.id}`}
                    >
                      {m.runningBalance.toFixed(2)}€
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{m.description ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
