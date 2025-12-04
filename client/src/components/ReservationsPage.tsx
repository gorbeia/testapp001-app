import { useState } from 'react';
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

// todo: remove mock functionality - replace with real API data
const mockReservations = [
  { id: '1', memberId: '1', memberName: 'Mikel Etxeberria', date: '2024-12-05', time: '13:00', eventType: 'bazkaria', table: 2, kitchen: true, guests: 8, notes: 'Urtebetetze afaria', status: 'confirmed', tableCost: 10, kitchenCost: 15 },
  { id: '2', memberId: '2', memberName: 'Ane Zelaia', date: '2024-12-05', time: '21:00', eventType: 'afaria', table: 1, kitchen: true, guests: 12, notes: '', status: 'confirmed', tableCost: 10, kitchenCost: 15 },
  { id: '3', memberId: '3', memberName: 'Jon Agirre', date: '2024-12-06', time: '11:00', eventType: 'hamaiketako', table: 3, kitchen: false, guests: 6, notes: 'Lagun artekoa', status: 'pending', tableCost: 10, kitchenCost: 0 },
  { id: '4', memberId: '4', memberName: 'Miren Urrutia', date: '2024-12-07', time: '14:00', eventType: 'bazkaria', table: 1, kitchen: true, guests: 10, notes: '', status: 'confirmed', tableCost: 10, kitchenCost: 15 },
];

export function ReservationsPage() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [useKitchen, setUseKitchen] = useState(false);

  const eventTypeLabels: Record<string, string> = {
    hamaiketako: t('hamaiketako'),
    bazkaria: t('lunch'),
    askaria: t('snack'),
    afaria: t('dinner'),
    urtebetetzea: t('birthday'),
  };

  const filteredReservations = mockReservations.filter((r) => {
    const matchesSearch = r.memberName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleCreateReservation = () => {
    toast({
      title: t('success'),
      description: 'Erreserba sortua / Reserva creada',
    });
    setIsDialogOpen(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t('reservations')}</h2>
          <p className="text-muted-foreground">Kudeatu mahai eta sukalde erreserbak</p>
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
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('date')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, 'PPP', { locale: language === 'eu' ? eu : es }) : t('selectDate')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        locale={language === 'eu' ? eu : es}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>{t('time')}</Label>
                  <Select>
                    <SelectTrigger data-testid="select-time">
                      <SelectValue placeholder={t('selectTime')} />
                    </SelectTrigger>
                    <SelectContent>
                      {['10:00', '11:00', '12:00', '13:00', '14:00', '19:00', '20:00', '21:00', '22:00'].map((time) => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('eventType')}</Label>
                <Select>
                  <SelectTrigger data-testid="select-event-type">
                    <SelectValue placeholder={t('selectEvent')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hamaiketako">{t('hamaiketako')}</SelectItem>
                    <SelectItem value="bazkaria">{t('lunch')}</SelectItem>
                    <SelectItem value="askaria">{t('snack')}</SelectItem>
                    <SelectItem value="afaria">{t('dinner')}</SelectItem>
                    <SelectItem value="urtebetetzea">{t('birthday')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('tableNumber')}</Label>
                  <Select>
                    <SelectTrigger data-testid="select-table">
                      <SelectValue placeholder={t('table')} />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((num) => (
                        <SelectItem key={num} value={num.toString()}>{t('table')} {num}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('guests')}</Label>
                  <Input type="number" min="1" max="20" defaultValue="6" data-testid="input-guests" />
                </div>
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

              <div className="space-y-2">
                <Label>{t('notes')}</Label>
                <Textarea placeholder="Ohar gehigarriak..." data-testid="textarea-notes" />
              </div>

              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="flex justify-between text-sm">
                    <span>{t('tableCost')}:</span>
                    <span>10.00€</span>
                  </div>
                  {useKitchen && (
                    <div className="flex justify-between text-sm mt-1">
                      <span>{t('kitchenCost')}:</span>
                      <span>15.00€</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium mt-2 pt-2 border-t">
                    <span>{t('totalCost')}:</span>
                    <span>{useKitchen ? '25.00€' : '10.00€'}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button onClick={handleCreateReservation} data-testid="button-save-reservation">
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
            <SelectItem value="all">{t('allTime')}</SelectItem>
            <SelectItem value="confirmed">{t('confirmed')}</SelectItem>
            <SelectItem value="pending">{t('pending')}</SelectItem>
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
                    <CardTitle className="text-lg">{reservation.memberName}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {reservation.date} - {reservation.time}
                    </p>
                  </div>
                  <Badge variant={reservation.status === 'confirmed' ? 'default' : 'secondary'}>
                    {reservation.status === 'confirmed' ? t('confirmed') : t('pending')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {eventTypeLabels[reservation.eventType]}
                  </Badge>
                  <Badge variant="outline">
                    {t('table')} {reservation.table}
                  </Badge>
                  {reservation.kitchen && (
                    <Badge variant="outline">
                      <Utensils className="mr-1 h-3 w-3" />
                      {t('kitchen')}
                    </Badge>
                  )}
                  <Badge variant="outline">
                    <Users className="mr-1 h-3 w-3" />
                    {reservation.guests}
                  </Badge>
                  <Badge variant="secondary">
                    {(reservation.tableCost + reservation.kitchenCost).toFixed(2)}€
                  </Badge>
                </div>
                {reservation.notes && (
                  <p className="mt-3 text-sm text-muted-foreground">{reservation.notes}</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
