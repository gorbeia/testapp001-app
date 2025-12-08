import { Calendar, ShoppingCart, CreditCard, Users, TrendingUp, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/lib/i18n';
import { useAuth, hasTreasurerAccess, hasCellarmanAccess } from '@/lib/auth';

// todo: remove mock functionality - replace with real API data
const mockStats = {
  todayReservations: 3,
  monthlyConsumptions: 245,
  pendingCredits: 1250.50,
  activeMembers: 48,
};

const mockUpcomingReservations = [
  { id: '1', member: 'Mikel Etxeberria', date: '2024-12-05', time: '13:00', type: 'bazkaria', table: 2, guests: 8 },
  { id: '2', member: 'Ane Zelaia', date: '2024-12-05', time: '21:00', type: 'afaria', table: 1, guests: 12 },
  { id: '3', member: 'Jon Agirre', date: '2024-12-06', time: '11:00', type: 'hamaiketako', table: 3, guests: 6 },
];

const mockRecentAnnouncements = [
  { id: '1', title: 'Aste Nagusiko ospakizuna', date: '2024-12-04', author: 'Administratzailea' },
  { id: '2', title: 'Txakolin berria iritsi da', date: '2024-12-03', author: 'Sotolaria' },
];

export function Dashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const eventTypeLabels: Record<string, string> = {
    hamaiketako: t('hamaiketako'),
    bazkaria: t('lunch'),
    askaria: t('snack'),
    afaria: t('dinner'),
    urtebetetzea: t('birthday'),
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold">{t('welcome')}, {user?.name?.split(' ')[0]}!</h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          {new Date().toLocaleDateString('eu-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t('reservations')}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.todayReservations}</div>
            <p className="text-xs text-muted-foreground">{t('today')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t('consumptions')}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.monthlyConsumptions}</div>
            <p className="text-xs text-muted-foreground">{t('thisMonth')}</p>
          </CardContent>
        </Card>

        {hasTreasurerAccess(user) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">{t('credits')}</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockStats.pendingCredits.toFixed(2)}€</div>
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
              <div className="text-2xl font-bold">{mockStats.activeMembers}</div>
              <p className="text-xs text-muted-foreground">Bazkideak aktibo</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t('reservations')} - Hurrengoak
            </CardTitle>
            <CardDescription>Datozen erreserbak</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockUpcomingReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 p-3 rounded-md bg-muted/50"
                  data-testid={`reservation-item-${reservation.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{reservation.member}</p>
                    <p className="text-xs text-muted-foreground">
                      {reservation.date} - {reservation.time}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {t('table')} {reservation.table}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {eventTypeLabels[reservation.type] || reservation.type}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {reservation.guests} {t('guests')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t('announcements')}
            </CardTitle>
            <CardDescription>Azken oharrak</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockRecentAnnouncements.map((announcement) => (
                <div
                  key={announcement.id}
                  className="p-3 rounded-md bg-muted/50"
                  data-testid={`announcement-item-${announcement.id}`}
                >
                  <p className="font-medium text-sm">{announcement.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {announcement.author} - {announcement.date}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
