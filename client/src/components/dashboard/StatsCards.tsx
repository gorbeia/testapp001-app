import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, ShoppingCart, CreditCard, Users } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { useAuth, hasTreasurerAccess, hasCellarmanAccess, hasAdminAccess } from '@/lib/auth';
import { DashboardStats } from './api';

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const { t } = useLanguage();
  const { user } = useAuth();

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium">{t('reservations')}</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.todayPeople}
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
            {hasAdminAccess(user) ? `${(stats.monthlyConsumptionsAmount || 0).toFixed(2)}€` : stats.monthlyConsumptions}
          </div>
          <p className="text-xs text-muted-foreground">
            {hasAdminAccess(user) ? t('thisMonth') : t('thisMonth')}
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
            <div className="text-2xl font-bold">{stats.pendingCredits.toFixed(2)}€</div>
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
            <div className="text-2xl font-bold">{stats.activeMembers}</div>
            <p className="text-xs text-muted-foreground">Bazkideak aktibo</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
