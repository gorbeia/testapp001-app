import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, ShoppingCart, CreditCard, Users, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { useAuth, hasTreasurerAccess, hasCellarmanAccess, hasAdminAccess } from '@/lib/auth';
import { DashboardStats } from './api';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface StatsCardsProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export function StatsCards({ stats, loading }: StatsCardsProps) {
  const { t } = useLanguage();
  const { user } = useAuth();

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
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
        <AlertDescription>
          {t('dashboardStatsUnavailable')}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium">{t('reservations')}</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.todayPeople || 0}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('today')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium">{t('consumptions')}</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {hasAdminAccess(user) ? `${(stats.monthlyConsumptionsAmount || 0).toFixed(2)}€` : `${(stats.memberMonthlyConsumptionsAmount || 0).toFixed(2)}€`}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('thisMonth')}
          </p>
        </CardContent>
      </Card>

      {(hasTreasurerAccess(user) || hasAdminAccess(user)) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t('credits')}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats.pendingCredits || 0).toFixed(2)}€</div>
            <p className="text-xs text-muted-foreground">{t('pending')}</p>
          </CardContent>
        </Card>
      )}

      {hasCellarmanAccess(user) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t('users')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeMembers || 0}</div>
            <p className="text-xs text-muted-foreground">Bazkideak aktibo</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
