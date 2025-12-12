import { useState, useEffect } from 'react';
import { Search, Eye, Calendar, User, Receipt, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import type { Consumption, ConsumptionItem, User as UserType } from '@shared/schema';

// API helper function
const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('auth:token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  return fetch(url, { ...options, headers });
};

interface ConsumptionWithUser extends Consumption {
  userName?: string;
  userUsername?: string;
}

interface ConsumptionWithItems {
  consumption: ConsumptionWithUser;
  items: ConsumptionItemWithProduct[];
}

interface ConsumptionItemWithProduct extends ConsumptionItem {
  productName?: string;
}

export function ConsumptionsListPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [consumptions, setConsumptions] = useState<ConsumptionWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConsumption, setSelectedConsumption] = useState<ConsumptionWithItems | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const statusLabels: Record<string, string> = {
    open: 'Irekita',
    closed: 'Itxita',
    cancelled: 'Baliogabetua',
  };

  const typeLabels: Record<string, string> = {
    bar: 'Barra',
    event: 'Ekitaldia',
    kitchen: 'Sukaldea',
  };

  // Fetch consumptions from API (with user data from JOIN)
  useEffect(() => {
    const fetchConsumptions = async () => {
      try {
        const response = await authFetch('/api/consumptions');
        if (response.ok) {
          const data = await response.json();
          setConsumptions(data);
        } else {
          throw new Error('Failed to fetch consumptions');
        }
      } catch (error) {
        console.error('Error fetching consumptions:', error);
        toast({
          title: 'Error',
          description: 'Kontsumoak ezin izan dira kargatu',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchConsumptions();
  }, [toast]);

  const filteredConsumptions = consumptions.filter((consumption) => {
    const matchesSearch = 
      consumption.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      consumption.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || consumption.status === statusFilter;
    const matchesType = typeFilter === 'all' || consumption.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const fetchConsumptionDetails = async (consumptionId: string) => {
    setDetailsLoading(true);
    try {
      const response = await authFetch(`/api/consumptions/${consumptionId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedConsumption(data);
      } else {
        throw new Error('Failed to fetch consumption details');
      }
    } catch (error) {
      console.error('Error fetching consumption details:', error);
      toast({
        title: 'Error',
        description: 'Kontsumoaren xehetasunak ezin izan dira kargatu',
        variant: 'destructive',
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  const getUserName = (consumption: ConsumptionWithUser) => {
    return consumption.userName || consumption.userUsername || 'Ezezaguna';
  };

  const formatDate = (dateString: string | null | Date) => {
    if (!dateString) return '-';
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleString('eu-ES');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Kontsumoak</h2>
        <p className="text-muted-foreground">Kudeatu kontsumo guztiak</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Bilatu kontsumoak..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Egoera guztiak</SelectItem>
              <SelectItem value="open">Irekita</SelectItem>
              <SelectItem value="closed">Itxita</SelectItem>
              <SelectItem value="cancelled">Baliogabetua</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mota guztiak</SelectItem>
              <SelectItem value="bar">Barra</SelectItem>
              <SelectItem value="event">Ekitaldia</SelectItem>
              <SelectItem value="kitchen">Sukaldea</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {t('consumptionList')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>{t('user')}</TableHead>
                <TableHead>{t('type')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('total')}</TableHead>
                <TableHead>{t('date')}</TableHead>
                <TableHead>{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t('loading')}
                  </TableCell>
                </TableRow>
              ) : filteredConsumptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t('noResults')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredConsumptions.map((consumption) => (
                  <TableRow key={consumption.id} data-testid="consumption-row">
                    <TableCell className="font-mono text-xs" data-testid="consumption-id">
                      {consumption.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {getUserName(consumption)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {typeLabels[consumption.type] || consumption.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={consumption.status === 'open' ? 'default' : 
                                consumption.status === 'closed' ? 'secondary' : 'destructive'}
                      >
                        {statusLabels[consumption.status] || consumption.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium" data-testid="consumption-total">
                      {parseFloat(consumption.totalAmount).toFixed(2)}€
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4" />
                        {formatDate(consumption.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => fetchConsumptionDetails(consumption.id)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ikusi
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
                          <DialogHeader>
                            <DialogTitle>Kontsumoaren Xehetasunak</DialogTitle>
                          </DialogHeader>
                          {selectedConsumption && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm font-medium">ID</p>
                                  <p className="font-mono text-xs">{selectedConsumption.consumption.id}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Mota</p>
                                  <p>{typeLabels[selectedConsumption.consumption.type]}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Egoera</p>
                                  <Badge>{statusLabels[selectedConsumption.consumption.status]}</Badge>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Totala</p>
                                  <p className="font-bold">{parseFloat(selectedConsumption.consumption.totalAmount).toFixed(2)}€</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Sorrera</p>
                                  <p>{formatDate(selectedConsumption.consumption.createdAt)}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Itxiera</p>
                                  <p>{formatDate(selectedConsumption.consumption.closedAt)}</p>
                                </div>
                              </div>
                              
                              {selectedConsumption.consumption.notes && (
                                <div>
                                  <p className="text-sm font-medium">Oharrak</p>
                                  <p className="text-sm">{selectedConsumption.consumption.notes}</p>
                                </div>
                              )}

                              <div>
                                <p className="text-sm font-medium mb-2">Produktuak</p>
                                <div className="space-y-2">
                                  {selectedConsumption.items.map((item) => (
                                    <div key={item.id} className="flex justify-between items-center p-2 bg-muted rounded">
                                      <div>
                                        <p className="font-medium">{item.productName || item.productId}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {item.quantity} x {parseFloat(item.unitPrice).toFixed(2)}€
                                        </p>
                                      </div>
                                      <p className="font-medium">
                                        {parseFloat(item.totalPrice).toFixed(2)}€
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
