import { useState, useEffect } from 'react';
import { Plus, Calendar as CalendarIcon, Search, Filter, Users, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { eu, es } from 'date-fns/locale';
import type { Reservation } from '@shared/schema';

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
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'lunch',
    startDate: new Date(),
    expectedGuests: 10,
    totalAmount: '0',
    notes: ''
  });

  const [useKitchen, setUseKitchen] = useState(false);

  // Calculate total amount
  const calculateTotal = (guests: number, kitchen: boolean) => {
    const guestCharge = guests * 2; // 2 euros per person
    const kitchenCharge = kitchen ? guests * 3 : 0; // 3 euros per person if kitchen is used
    return (guestCharge + kitchenCharge).toString();
  };

  // Update total amount when guests or kitchen changes
  useEffect(() => {
    const total = calculateTotal(formData.expectedGuests, useKitchen);
    setFormData(prev => ({ ...prev, totalAmount: total }));
  }, [formData.expectedGuests, useKitchen]);

  const eventTypeLabels: Record<string, string> = {
    hamaiketako: t('hamaiketako'),
    lunch: t('lunch'),
    snack: t('snack'),
    dinner: t('dinner'),
    birthday: t('birthday'),
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
  }, []);

  const loadReservations = async () => {
    try {
      const response = await authFetch('/api/reservations');
      if (response.ok) {
        const data = await response.json();
        setReservations(data);
      }
    } catch (error) {
      console.error('Error loading reservations:', error);
      toast({
        title: t('error'),
        description: 'Errorea erreserbak kargatzean',
        variant: 'destructive',
      });
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
      const reservationData = {
        ...formData,
        startDate: formData.startDate.toISOString(),
      };

      const response = await authFetch('/api/reservations', {
        method: 'POST',
        body: JSON.stringify(reservationData),
      });

      if (response.ok) {
        const newReservation = await response.json();
        setReservations([...reservations, newReservation]);
        
        toast({
          title: t('success'),
          description: 'Erreserba sortua / Reserva creada',
        });
        
        // Reset form
        setFormData({
          name: '',
          type: 'lunch',
          startDate: new Date(),
          expectedGuests: 10,
          totalAmount: '0',
          notes: ''
        });
        
        setIsDialogOpen(false);
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Errorea erreserba sortzean');
      }
    } catch (error) {
      console.error('Error creating reservation:', error);
      toast({
        title: t('error'),
        description: error instanceof Error ? error.message : 'Errorea erreserba sortzean',
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

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t('reservations')}</h2>
          <p className="text-muted-foreground">Kudeatu erreserbak</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-reservation">
              <Plus className="mr-2 h-4 w-4" />
              {t('newReservation')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
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
                      <SelectItem value="hamaiketako">{t('hamaiketako')}</SelectItem>
                      <SelectItem value="lunch">{t('lunch')}</SelectItem>
                      <SelectItem value="snack">{t('snack')}</SelectItem>
                      <SelectItem value="dinner">{t('dinner')}</SelectItem>
                      <SelectItem value="birthday">{t('birthday')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('guests')}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.expectedGuests}
                    onChange={(e) => setFormData({ ...formData, expectedGuests: parseInt(e.target.value) || 0 })}
                    data-testid="input-expected-guests"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('date')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="date-picker-button">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.startDate ? format(formData.startDate, 'PPP', { locale: language === 'eu' ? eu : es }) : t('selectDate')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.startDate}
                      onSelect={(date) => date && setFormData({ ...formData, startDate: date })}
                      locale={language === 'eu' ? eu : es}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="kitchen"
                  checked={useKitchen}
                  onCheckedChange={(checked) => setUseKitchen(checked as boolean)}
                  data-testid="checkbox-kitchen"
                />
                <Label htmlFor="kitchen" className="flex items-center gap-2">
                  <Utensils className="h-4 w-4" />
                  {t('kitchenEquipment')}
                </Label>
              </div>

              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="flex justify-between text-sm">
                    <span>{t('guests')} ({formData.expectedGuests} × 2€):</span>
                    <span>{(formData.expectedGuests * 2).toFixed(2)}€</span>
                  </div>
                  {useKitchen && (
                    <div className="flex justify-between text-sm mt-1">
                      <span>{t('kitchenCost')} ({formData.expectedGuests} × 3€):</span>
                      <span>{(formData.expectedGuests * 3).toFixed(2)}€</span>
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
                  <div>
                    <CardTitle className="text-lg">{reservation.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(reservation.startDate), 'PPP', { locale: language === 'eu' ? eu : es })}
                    </p>
                  </div>
                  <Badge variant={getStatusVariant(reservation.status)}>
                    {statusLabels[reservation.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="outline">
                    {eventTypeLabels[reservation.type]}
                  </Badge>
                  <Badge variant="outline">
                    <Users className="mr-1 h-3 w-3" />
                    {reservation.expectedGuests}
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
    </div>
  );
}
