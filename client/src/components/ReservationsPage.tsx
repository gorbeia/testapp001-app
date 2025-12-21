import { useState, useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Plus, Calendar as CalendarIcon, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';
import { eu, es } from 'date-fns/locale';
import type { Reservation } from '@shared/schema';
import { ErrorFallback } from '@/components/ErrorBoundary';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import MonthGrid from '@/components/MonthGrid';
import { ReservationDialog } from '@/components/ReservationDialog';
import { useUrlFilter } from '@/hooks/useUrlFilter';

interface ReservationWithUser extends Reservation {
  userName: string | null;
}

const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('auth:token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  return fetch(url, { ...options, headers });
};

function ReservationsPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const monthFilter = useUrlFilter({ baseUrl: '/erreserbak', paramName: 'month', initialValue: '' });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reservations, setReservations] = useState<ReservationWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Event type labels
  const eventTypeLabels: Record<string, string> = {
    bazkaria: t('bazkaria'),
    afaria: t('afaria'),
    askaria: t('askaria'),
    hamaiketakako: t('hamaiketakoa'),
  };

  const statusLabels: Record<string, string> = {
    pending: t('pending'),
    confirmed: t('confirmed'),
    cancelled: t('cancelled'),
    completed: t('completed'),
  };

  // Load reservations
  useEffect(() => {
    loadReservations();
  }, [monthFilter.value]);

  const loadReservations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (monthFilter.value) {
        // Extract month number from YYYY-MM format for API
        const monthParam = monthFilter.value.split('-')[1];
        params.append('month', monthParam);
      }
      
      const response = await authFetch(`/api/reservations?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setReservations(data);
      } else {
        throw new Error('Failed to load reservations');
      }
    } catch (error) {
      console.error('Error loading reservations:', error);
      setError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  // Filter reservations - search and type filtering
  const filteredReservations = reservations.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (r.notes && r.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (r.userName && r.userName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === 'all' || r.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'confirmed': return 'default';
      case 'pending': return 'secondary';
      case 'cancelled': return 'destructive';
      case 'completed': return 'outline';
      default: return 'secondary';
    }
  };

  const handleReservationSuccess = () => {
    loadReservations();
  };

  if (isInitialLoad && loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="text-center">{t('loading')}</div>
      </div>
    );
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{t('upcomingReservations')}</h2>
            <p className="text-muted-foreground">{t('upcomingReservationsDescription')}</p>
          </div>
          <Button data-testid="button-new-reservation" onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('newReservation')}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`${t('searchReservation')}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-reservations"
            />
          </div>
          
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder={t('type')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all')}</SelectItem>
              <SelectItem value="bazkaria">{eventTypeLabels.bazkaria}</SelectItem>
              <SelectItem value="afaria">{eventTypeLabels.afaria}</SelectItem>
              <SelectItem value="askaria">{eventTypeLabels.askaria}</SelectItem>
              <SelectItem value="hamaiketakako">{eventTypeLabels.hamaiketakako}</SelectItem>
            </SelectContent>
          </Select>
          
          <MonthGrid 
            selectedMonth={monthFilter.value} 
            onMonthChange={monthFilter.setValue}
            className="w-full sm:w-48"
            mode="future"
          />
        </div>

        <div className="grid gap-4">
          {loading && !isInitialLoad ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">{t('loading')}</p>
              </CardContent>
            </Card>
          ) : filteredReservations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t('noReservationsFound')}</p>
              </CardContent>
            </Card>
          ) : (
            filteredReservations.map((reservation) => (
              <Card key={reservation.id} data-testid={`card-reservation-${reservation.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{reservation.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {reservation.userName && `${reservation.userName} • `}
                        {format(new Date(reservation.startDate), 'PPP', { locale: language === 'eu' ? eu : es })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusVariant(reservation.status)}>
                        {statusLabels[reservation.status]}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge variant="outline">
                      {eventTypeLabels[reservation.type]}
                    </Badge>
                    <Badge variant="outline">
                      <Users className="mr-1 h-3 w-3" />
                      {reservation.guests}
                    </Badge>
                    <Badge variant="outline">
                      {reservation.table || 'No table'}
                    </Badge>
                    <Badge variant="secondary">
                      {parseFloat(reservation.totalAmount).toFixed(2)}€
                    </Badge>
                  </div>
                  {reservation.notes && (
                    <p className="text-sm text-muted-foreground">{reservation.notes}</p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
        
        <ReservationDialog 
          open={isDialogOpen} 
          onOpenChange={setIsDialogOpen}
          onSuccess={handleReservationSuccess}
        />
      </div>
    </ErrorBoundary>
  );
}

export { ReservationsPage };
export default ReservationsPage;