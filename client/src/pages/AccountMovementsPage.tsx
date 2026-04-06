import * as React from "react";
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
import { Label } from "@/components/ui/label";

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

type UserRow = { id: string; name: string | null; username: string };

export function AccountMovementsPage() {
  const { t } = useLanguage();
  const monthFilter = useUrlFilter({
    baseUrl: "/mugimenduak",
    paramName: "month",
    initialValue: "",
  });
  const [type, setType] = React.useState<string>("all");
  const [userId, setUserId] = React.useState<string>("all");
  const month = monthFilter.value;

  const usersQuery = useQuery({
    queryKey: ["users-for-movements"],
    queryFn: async () => {
      const res = await authFetch("/api/users");
      if (!res.ok) throw new Error("users");
      return res.json() as Promise<UserRow[]>;
    },
  });

  const query = useQuery({
    queryKey: ["account-movements-admin", month, type, userId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (month) params.set("month", month);
      if (type !== "all") params.set("type", type);
      if (userId !== "all") params.set("userId", userId);
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
      }>;
    },
  });

  return (
    <div className="p-4 sm:p-6 space-y-4" data-testid="admin-movements-page">
      <h1 className="text-2xl font-bold" data-testid="admin-movements-title">
        {t("adminMovements")}
      </h1>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="w-full sm:w-48">
          <Label className="text-xs">{t("month")}</Label>
          <div data-testid="admin-filter-month">
            <MonthGrid
              selectedMonth={monthFilter.value}
              onMonthChange={monthFilter.setValue}
              className="w-full mt-1"
              mode="past"
              yearRange={{ past: 3, future: 0 }}
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">{t("movementType")}</Label>
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
        </div>
        <div>
          <Label className="text-xs">{t("filterByMember")}</Label>
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
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle data-testid="admin-movements-count">
            {query.data?.total ?? 0} {t("total")}
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                    <TableCell>{new Date(m.createdAt).toLocaleString()}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
}
