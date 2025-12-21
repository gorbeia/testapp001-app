import { useState, useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Search, Calendar, Users, MapPin, Eye, X, ChefHat, Calculator, Plus } from 'lucide-react';
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
import { ReservationDialog } from '@/components/ReservationDialog';

export function MyReservationsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // URL state management
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('status') || 'all';
    }
    return 'all';
  });
  const [typeFilter, setTypeFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('type') || 'all';
    }
    return 'all';
  });
  const [monthFilter, setMonthFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('month') || '';
    }
    return '';
  });

  // Fetch user's reservations
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [society, setSociety] = useState<any>(null);

  // Load society data
  const loadSociety = async () => {
    try {
      const response = await authFetch('/api/societies/user');
      if (response.ok) {
        const data = await response.json();
        setSociety(data);
      }
    } catch (error) {
      console.error('Error loading society:', error);
    }
  };

  useEffect(() => {
    loadSociety();
  }, []);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (typeFilter !== 'all') params.set('type', typeFilter);
    if (monthFilter) params.set('month', monthFilter);
    
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    if (newUrl !== window.location.pathname + window.location.search) {
      window.history.replaceState({}, '', newUrl);
    }
  }, [statusFilter, typeFilter, monthFilter]);

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
      bazkaria: t('bazkaria'),
      afaria: t('afaria'),
      askaria: t('askaria'),
      hamaiketakako: t('hamaiketakoa'),
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

  const handleReservationSuccess = () => {
    fetchReservations();
  };

  const isFutureReservation = (reservation: Reservation) => {
    return new Date(reservation.startDate) > new Date();
  };

  // Calculate cost breakdown for a reservation
  const calculateCostBreakdown = (reservation: Reservation) => {
    if (!society) {
      return {
        reservationCost: 0,
        kitchenCost: 0,
        totalCost: 0,
        pricePerPerson: 0,
        guests: reservation.guests || 0
      };
    }
    
    const guests = reservation.guests || 0;
    const reservationPrice = parseFloat(society.reservationPricePerMember) || 2;
    const kitchenPrice = parseFloat(society.kitchenPricePerMember) || 3;
    
    const reservationCost = guests * reservationPrice;
    const kitchenCost = reservation.useKitchen ? guests * kitchenPrice : 0;
    const totalCost = reservationCost + kitchenCost;
    const pricePerPerson = guests > 0 ? totalCost / guests : 0;
    
    return {
      reservationCost,
      kitchenCost,
      totalCost,
      pricePerPerson,
      guests
    };
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t('myReservations')}</h2>
          <p className="text-muted-foreground">{t('viewAllReservations')}</p>
        </div>
        <Button data-testid="button-new-reservation" onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('newReservation')}
        </Button>
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
            <SelectItem value="bazkaria">{t('bazkaria')}</SelectItem>
            <SelectItem value="afaria">{t('afaria')}</SelectItem>
            <SelectItem value="askaria">{t('askaria')}</SelectItem>
            <SelectItem value="hamaiketakako">{t('hamaiketakoa')}</SelectItem>
          </SelectContent>
        </Select>

        <MonthGrid 
          selectedMonth={monthFilter} 
          onMonthChange={setMonthFilter}
          className="w-full sm:w-48"
          mode="all"
          yearRange={{ past: 3, future: 3 }}
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
                        {(reservation.status === 'pending' || reservation.status === 'confirmed') && isFutureReservation(reservation) ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancelReservation(reservation.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedReservation(reservation)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
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

              {/* Cost Breakdown */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-lg">{t('costBreakdown')}</h3>
                </div>
                
                <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-600" />
                      <span className="text-sm">{t('guests')}</span>
                    </div>
                    <span className="font-medium">{calculateCostBreakdown(selectedReservation).guests} {t('persons')}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{t('reservationCost')} ({society?.reservationPricePerMember || 2}€/{t('person')})</span>
                    <span className="font-medium">{calculateCostBreakdown(selectedReservation).reservationCost.toFixed(2)}€</span>
                  </div>
                  
                  {selectedReservation.useKitchen && (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <ChefHat className="h-4 w-4 text-orange-600" />
                        <span className="text-sm">{t('kitchenCost')} ({society?.kitchenPricePerMember || 3}€/{t('person')})</span>
                      </div>
                      <span className="font-medium">{calculateCostBreakdown(selectedReservation).kitchenCost.toFixed(2)}€</span>
                    </div>
                  )}
                  
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">{t('totalCost')}</span>
                      <span className="font-bold text-lg text-blue-600">
                        {calculateCostBreakdown(selectedReservation).totalCost.toFixed(2)}€
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-gray-600">{t('pricePerPerson')}</span>
                      <span className="text-sm text-gray-600">
                        {calculateCostBreakdown(selectedReservation).pricePerPerson.toFixed(2)}€
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      <ReservationDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
        onSuccess={handleReservationSuccess}
      />
    </div>
    </ErrorBoundary>
  );
}
