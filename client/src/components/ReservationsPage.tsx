import { useState, useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Plus, Calendar as CalendarIcon, Search, Filter, Users, Utensils, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { eu, es } from 'date-fns/locale';
import type { Reservation, Table } from '@shared/schema';
import { ErrorFallback } from '@/components/ErrorBoundary';
import { ErrorDisplay } from '@/components/ErrorDisplay';

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

export function ReservationsPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reservations, setReservations] = useState<ReservationWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [society, setSociety] = useState<any>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState<string | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'bazkaria',
    startDate: new Date(),
    guests: 10,
    useKitchen: false,
    table: '',
    totalAmount: '0',
    notes: ''
  });

  // Get all active tables
  const getAllTables = () => {
    return tables.filter(table => table.isActive);
  };

  // Check if selected table can accommodate guests
  const isTableSuitable = (tableName: string) => {
    const table = tables.find(t => t.name === tableName);
    if (!table || table.minCapacity === null || table.maxCapacity === null) return false;
    return formData.guests >= table.minCapacity && formData.guests <= table.maxCapacity;
  };
  const calculateTotal = (guests: number, kitchen: boolean) => {
    if (!society) return '0';
    
    const reservationPrice = parseFloat(society.reservationPricePerMember) || 2;
    const kitchenPrice = parseFloat(society.kitchenPricePerMember) || 3;
    
    const guestCharge = guests * reservationPrice;
    const kitchenCharge = kitchen ? guests * kitchenPrice : 0;
    return (guestCharge + kitchenCharge).toString();
  };

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
      setError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  // Update total amount when guests or kitchen changes
  useEffect(() => {
    const total = calculateTotal(formData.guests, formData.useKitchen);
    setFormData(prev => ({ ...prev, totalAmount: total }));
  }, [formData.guests, formData.useKitchen, society]);

  const eventTypeLabels: Record<string, string> = {
    bazkaria: t('bazkaria'),
    afaria: t('afaria'),
    askaria: t('askaria'),
    hamaiketakoa: t('hamaiketakoa'),
  };

  const statusLabels: Record<string, string> = {
    pending: t('pending'),
    confirmed: t('confirmed'),
    cancelled: t('cancelled'),
    completed: t('completed'),
  };

  // Load reservations and society data
  useEffect(() => {
    loadReservations();
    loadSociety();
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      const response = await authFetch('/api/tables/available');
      if (response.ok) {
        const data = await response.json();
        setTables(data);
      }
    } catch (error) {
      console.error('Error loading tables:', error);
      setError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const loadReservations = async () => {
    try {
      const response = await authFetch('/api/reservations');
      if (response.ok) {
        const data = await response.json();
        setReservations(data);
      }
    } catch (error) {
      console.error('Error loading reservations:', error);
      setError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
    }
  };

  const filteredReservations = reservations.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (r.notes && r.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleCreateReservation = async () => {
    try {
      // Validate table capacity
      if (formData.table && !isTableSuitable(formData.table)) {
        throw new Error(`Hautatutako mahaiak ez ditu ${formData.guests} pertsona hartzeko kapazitaterik. Mesedez, hautatu mahaia egoki bat.`);
      }

      // Ensure we have a valid Date object
      let startDate: Date;
      if (formData.startDate instanceof Date) {
        startDate = formData.startDate;
      } else {
        startDate = new Date(formData.startDate);
      }
      
      // Check if the date is valid
      if (isNaN(startDate.getTime())) {
        throw new Error(t('invalidDate'));
      }
      
      const reservationData = {
        ...formData,
        startDate: startDate.toISOString(),
      };

      console.log('Sending reservation data:', reservationData);

      const response = await authFetch('/api/reservations', {
        method: 'POST',
        body: JSON.stringify(reservationData),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Backend response:', data);
        
        // Use the updated reservations list from backend (includes user names)
        if (data && Array.isArray(data.reservations)) {
          setReservations(data.reservations);
        } else {
          console.error('Invalid reservations data from backend:', data);
          // Fallback: reload reservations from scratch
          await loadReservations();
        }
        
        toast({
          title: t('success'),
          description: 'Erreserba sortua / Reserva creada',
        });
        
        // Reset form
        setFormData({
          name: '',
          type: 'bazkaria',
          startDate: new Date(),
          guests: 10,
          useKitchen: false,
          table: '',
          totalAmount: '0',
          notes: ''
        });
        
        setIsDialogOpen(false);
      } else {
        const error = await response.json();
        throw new Error(error.message || t('errorCreatingReservation'));
      }
    } catch (error) {
      console.error('Error creating reservation:', error);
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('errorCreatingReservation'),
        variant: 'destructive',
      });
    }
  };

  const handleCancelReservation = (reservationId: string) => {
    setReservationToCancel(reservationId);
    setCancelDialogOpen(true);
  };

  const confirmCancelReservation = async () => {
    if (!reservationToCancel) return;
    
    try {
      const response = await authFetch(`/api/reservations/${reservationToCancel}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'cancelled' }),
      });

      if (response.ok) {
        const updatedReservation = await response.json();
        setReservations(reservations.map(r => r.id === reservationToCancel ? updatedReservation : r));
        
        toast({
          title: t('success'),
          description: 'Erreserba bertan behera utzita / Reserva cancelada', 
        });
        
        setCancelDialogOpen(false);
        setReservationToCancel(null);
      } else {
        const error = await response.json();
        throw new Error(error.message || t('errorCancellingReservation'));
      }
    } catch (error) {
      console.error('Error cancelling reservation:', error);
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : t('errorCancellingReservation'),
        variant: 'destructive',
      });
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'confirmed': return 'default';
      case 'pending': return 'secondary';
      case 'cancelled': return 'destructive';
      case 'completed': return 'outline';
      default: return 'secondary';
    }
  };

  if (loading) {
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
          <h2 className="text-2xl font-bold">{t('reservations')}</h2>
          <p className="text-muted-foreground">{t('manageReservations')}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-reservation">
              <Plus className="mr-2 h-4 w-4" />
              {t('newReservation')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg" data-testid="dialog-content">
            <DialogHeader>
              <DialogTitle>{t('newReservation')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>{t('name')}</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Erreserbaren izena"
                  data-testid="input-reservation-name"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('type')}</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger data-testid="select-reservation-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bazkaria">{t('bazkaria')}</SelectItem>
                      <SelectItem value="afaria">{t('afaria')}</SelectItem>
                      <SelectItem value="askaria">{t('askaria')}</SelectItem>
                      <SelectItem value="hamaiketakoa">{t('hamaiketakoa')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('guests')}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.guests}
                    onChange={(e) => setFormData({ ...formData, guests: parseInt(e.target.value) || 0 })}
                    data-testid="input-guests"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('date')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="date-picker-button">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.startDate ? format(formData.startDate instanceof Date ? formData.startDate : new Date(formData.startDate), 'PPP', { locale: language === 'eu' ? eu : es }) : t('selectDate')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.startDate}
                      onSelect={(date) => date && setFormData({ ...formData, startDate: date })}
                      locale={language === 'eu' ? eu : es}
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>{t('table')}</Label>
                <Select value={formData.table} onValueChange={(value) => setFormData({ ...formData, table: value })}>
                  <SelectTrigger data-testid="select-table">
                    <SelectValue placeholder={t('selectTable')} />
                  </SelectTrigger>
                  <SelectContent>
                    {getAllTables().length > 0 ? (
                      getAllTables().map((table) => {
                        const isSuitable = table.minCapacity !== null && table.maxCapacity !== null && 
                                        formData.guests >= table.minCapacity && formData.guests <= table.maxCapacity;
                        return (
                          <SelectItem 
                            key={table.id} 
                            value={table.name}
                            disabled={!isSuitable}
                          >
                            <div className="flex flex-col">
                              <span>{table.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {table.minCapacity ?? '?'}-{table.maxCapacity ?? '?'} pertsona
                                {!isSuitable && ` (Ez egokia ${formData.guests} pertsonentzat)`}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })
                    ) : (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        Ez dago mahairik eskuragarri
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {formData.table && !isTableSuitable(formData.table) && (
                  <p className="text-sm text-amber-600">
                    {formData.table} mahaiak ez ditu {formData.guests} pertsona hartzeko kapazitaterik.
                    Mahaiaren kapazitatea: {tables.find(t => t.name === formData.table)?.minCapacity ?? '?'}-{tables.find(t => t.name === formData.table)?.maxCapacity ?? '?'} pertsona.
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="kitchen"
                  checked={formData.useKitchen}
                  onCheckedChange={(checked) => setFormData({ ...formData, useKitchen: checked as boolean })}
                  data-testid="checkbox-kitchen"
                />
                <Label htmlFor="kitchen" className="flex items-center gap-2">
                  <Utensils className="h-4 w-4" />
                  {t('kitchenEquipment')}
                </Label>
              </div>

              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  {society ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>{t('guests')} ({formData.guests} × {society.reservationPricePerMember}€):</span>
                        <span>{(formData.guests * parseFloat(society.reservationPricePerMember)).toFixed(2)}€</span>
                      </div>
                      {formData.useKitchen && (
                        <div className="flex justify-between text-sm mt-1">
                          <span>{t('kitchenCost')} ({formData.guests} × {society.kitchenPricePerMember}€):</span>
                          <span>{(formData.guests * parseFloat(society.kitchenPricePerMember)).toFixed(2)}€</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex justify-between text-sm">
                      <span>{t('loading')}...</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium mt-2 pt-2 border-t">
                    <span>{t('totalCost')}:</span>
                    <span>{formData.totalAmount}€</span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label>{t('notes')}</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ohar gehigarriak..."
                  data-testid="textarea-reservation-notes"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button onClick={handleCreateReservation} data-testid="button-save-reservation" disabled={!formData.name}>
                  {t('reserve')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`${t('search')}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-reservations"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-filter-status">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all')}</SelectItem>
            <SelectItem value="pending">{t('pending')}</SelectItem>
            <SelectItem value="confirmed">{t('confirmed')}</SelectItem>
            <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
            <SelectItem value="completed">{t('completed')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4">
        {filteredReservations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t('noResults')}</p>
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
                    {reservation.status === 'confirmed' && 
                      (reservation.userId === user?.id || 
                       ['administratzailea', 'diruzaina', 'sotolaria'].includes(user?.function || '')) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelReservation(reservation.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
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
      
      <AlertDialog open={cancelDialogOpen} onOpenChange={(open) => !open && setCancelDialogOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cancelReservation')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('cancelReservationConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancelDialogOpen(false)}>
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancelReservation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </ErrorBoundary>
  );
}
