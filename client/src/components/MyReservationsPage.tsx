import { useState, useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Search, Calendar, Users, MapPin, Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MonthGrid from '@/components/MonthGrid';
import { useLanguage } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api';
import type { Reservation } from '@shared/schema';
import { ErrorFallback } from '@/components/ErrorBoundary';
import { ErrorDisplay } from '@/components/ErrorDisplay';

export function MyReservationsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('');

  // Fetch user's reservations
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch user's reservations
  const fetchReservations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (monthFilter) {
        // Extract month number from YYYY-MM format for API
        const monthParam = monthFilter.split('-')[1];
        params.append('month', monthParam);
      }
      
      const response = await authFetch(`/api/reservations/user?${params}`);
      if (!response.ok) throw new Error('Failed to fetch reservations');
      const data = await response.json();
      setReservations(data);
    } catch (error) {
      console.error('Error fetching reservations:', error);
      setError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, [searchTerm, statusFilter, typeFilter, monthFilter]);

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } } = {
      pending: { label: t('pending'), variant: 'secondary' },
      confirmed: { label: t('confirmed'), variant: 'default' },
      cancelled: { label: t('cancelled'), variant: 'destructive' },
      completed: { label: t('completed'), variant: 'outline' },
    };
    const statusInfo = statusMap[status] || { label: status, variant: 'outline' };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const typeLabels: Record<string, string> = {
      event: 'Ekitaldia',
      meeting: 'Bilera',
      private: 'Pribatua',
      other: 'Besteak',
    };
    const label = typeLabels[type] || type;
    return <Badge variant="outline">{label}</Badge>;
  };

  const formatDate = (date: string | Date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('eu-ES');
  };

  const formatTime = (date: string | Date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleTimeString('eu-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const filteredReservations = reservations.filter((reservation) => {
    const matchesSearch = reservation.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (reservation.table && reservation.table.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = !statusFilter || statusFilter === 'all' || reservation.status === statusFilter;
    const matchesType = typeFilter === 'all' || reservation.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleCancelReservation = async (reservationId: string) => {
    const confirmed = window.confirm(t('confirmCancelReservation'));
    if (!confirmed) return;

    try {
      const response = await authFetch(`/api/reservations/${reservationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      if (response.ok) {
        const updatedReservation = await response.json();
        setReservations(reservations.map(r => r.id === reservationId ? updatedReservation : r));
        toast({
          title: t('success'),
          description: t('reservationCancelled'),
        });
      }
    } catch (error) {
      console.error('Error cancelling reservation:', error);
      toast({
        title: "Errorea",
        description: "Erreserbak bertan behera uztean errorea gertatu da",
        variant: "destructive",
      });
    }
  };

  const isFutureReservation = (reservation: Reservation) => {
    return new Date(reservation.startDate) > new Date();
  };

  if (isInitialLoad && loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="text-center py-12">
          <p>{t('loading')}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t('myReservations')}</h2>
        <p className="text-muted-foreground">{t('viewAllReservations')}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-4 w-4" />
          <Input
            placeholder={`${t('search')}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatus')}</SelectItem>
            <SelectItem value="pending">{t('pending')}</SelectItem>
            <SelectItem value="confirmed">{t('confirmed')}</SelectItem>
            <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
            <SelectItem value="completed">{t('completed')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allTypes')}</SelectItem>
            <SelectItem value="event">Ekitaldia</SelectItem>
            <SelectItem value="meeting">Bilera</SelectItem>
            <SelectItem value="private">Pribatua</SelectItem>
            <SelectItem value="other">Besteak</SelectItem>
          </SelectContent>
        </Select>

        <MonthGrid 
          selectedMonth={monthFilter} 
          onMonthChange={setMonthFilter}
          className="w-full sm:w-48"
        />
      </div>

      {/* Reservations Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('name')}</TableHead>
                <TableHead>{t('date')}</TableHead>
                <TableHead>{t('time')}</TableHead>
                <TableHead>{t('table')}</TableHead>
                <TableHead>{t('guests')}</TableHead>
                <TableHead>{t('type')}</TableHead>
                <TableHead className="text-right">{t('status')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {t('loading')}
                  </TableCell>
                </TableRow>
              ) : filteredReservations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {t('noReservationsFound')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredReservations.map((reservation) => (
                  <TableRow key={reservation.id}>
                    <TableCell className="font-medium">{reservation.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span>{formatDate(reservation.startDate)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatTime(reservation.startDate)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span>{reservation.table}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span>{reservation.guests}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(reservation.type)}</TableCell>
                    <TableCell className="text-right">
                      {getStatusBadge(reservation.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedReservation(reservation)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(reservation.status === 'pending' || reservation.status === 'confirmed') && isFutureReservation(reservation) ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancelReservation(reservation.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Reservation Details Dialog */}
      <Dialog open={!!selectedReservation} onOpenChange={() => setSelectedReservation(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{t('reservationDetails')}</DialogTitle>
          </DialogHeader>
          {selectedReservation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">{t('name')}</p>
                  <p>{selectedReservation.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">{t('type')}</p>
                  <p>{getTypeBadge(selectedReservation.type)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">{t('status')}</p>
                  <p>{getStatusBadge(selectedReservation.status)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">{t('table')}</p>
                  <p>{selectedReservation.table}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">{t('date')}</p>
                  <p>{formatDate(selectedReservation.startDate)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">{t('time')}</p>
                  <p>{formatTime(selectedReservation.startDate)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">{t('guests')}</p>
                  <p>{selectedReservation.guests}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">{t('useKitchen')}</p>
                  <p>{selectedReservation.useKitchen ? t('yes') : t('no')}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">{t('notes')}</p>
                <p className="text-sm text-gray-600">{selectedReservation.notes || t('noNotes')}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </ErrorBoundary>
  );
}
