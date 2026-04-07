import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Calendar,
  ShoppingCart,
  CreditCard,
  Users,
  AlertCircle,
  Wallet,
  Package,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useAuth, userCan } from "@/lib/auth";
import { Permission } from "@shared/permissions";
import { DashboardStats } from "./api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "wouter";

interface StatsCardsProps {
  stats: DashboardStats | null;
  loading: boolean;
}

function balanceAmountClass(b: number) {
  if (b < 0) return "text-destructive";
  if (b > 0) return "text-green-600";
  return "text-muted-foreground";
}

export function StatsCards({ stats, loading }: StatsCardsProps) {
  const { t } = useLanguage();
  const { user } = useAuth();

  const showInventoryWidgets = userCan(user, Permission.PRODUCTS_MANAGE);
  const skeletonCount = showInventoryWidgets ? 5 : 3;

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(skeletonCount)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <div className="h-4 bg-gray-200 rounded w-20"></div>
              <div className="h-4 w-4 bg-gray-200 rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-12"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{t("dashboardStatsUnavailable")}</AlertDescription>
      </Alert>
    );
  }

  const useMovementsBalance = stats.sepaModeDisabled;
  const balanceValue = stats.memberAccountBalance ?? 0;
  const balanceStatusKey = !useMovementsBalance
    ? null
    : balanceValue < 0
      ? "balanceStatusOwed"
      : balanceValue > 0
        ? "balanceStatusCredit"
        : "balanceStatusZero";

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium">{t("reservations")}</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.todayPeople || 0}</div>
          <p className="text-xs text-muted-foreground">{t("today")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium">{t("dashboardConsumptions")}</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {userCan(user, Permission.USERS_MANAGE)
              ? `${(stats.monthlyConsumptionsAmount || 0).toFixed(2)}€`
              : `${(stats.memberMonthlyConsumptionsAmount || 0).toFixed(2)}€`}
          </div>
          <p className="text-xs text-muted-foreground">{t("thisMonth")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium">
            {useMovementsBalance ? t("currentBalance") : t("myDebts")}
          </CardTitle>
          {useMovementsBalance ? (
            <Wallet className="h-4 w-4 text-muted-foreground" />
          ) : (
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          )}
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${
              useMovementsBalance ? balanceAmountClass(balanceValue) : ""
            }`}
          >
            {useMovementsBalance
              ? `${balanceValue.toFixed(2)}€`
              : `${(stats.pendingCredits || 0).toFixed(2)}€`}
          </div>
          <p className="text-xs text-muted-foreground">
            {useMovementsBalance ? (balanceStatusKey ? t(balanceStatusKey) : "") : t("pending")}
          </p>
        </CardContent>
      </Card>

      {userCan(user, Permission.PRODUCTS_MANAGE) && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">{t("users")}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeMembers || 0}</div>
              <p className="text-xs text-muted-foreground">Bazkideak aktibo</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">{t("dashboardLowStockTitle")}</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-2xl font-bold">{stats.lowStockCount ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                {(stats.lowStockCount ?? 0) === 0
                  ? t("dashboardLowStockNone")
                  : t("dashboardLowStockHint")}
              </p>
              {(stats.lowStockCount ?? 0) > 0 && (stats.lowStockProducts?.length ?? 0) > 0 && (
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {stats.lowStockProducts!.slice(0, 3).map(p => (
                    <li key={p.id}>
                      {t("dashboardLowStockLine", {
                        name: p.name,
                        stock: p.stock,
                        unit: p.unit,
                        min: p.minStock,
                      })}
                    </li>
                  ))}
                </ul>
              )}
              {(stats.lowStockCount ?? 0) > (stats.lowStockProducts?.length ?? 0) && (
                <p className="text-xs text-muted-foreground">
                  {t("dashboardLowStockMore", {
                    n: (stats.lowStockCount ?? 0) - (stats.lowStockProducts?.length ?? 0),
                  })}
                </p>
              )}
              <Link href="/produktuak" className="text-xs text-primary block hover:underline">
                {t("dashboardLowStockView")}
              </Link>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
