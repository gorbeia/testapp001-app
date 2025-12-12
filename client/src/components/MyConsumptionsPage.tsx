import { useState, useEffect } from 'react';
import { Search, Eye, Calendar, Receipt, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MonthGrid from '@/components/MonthGrid';
import { useLanguage } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import type { Consumption, ConsumptionItem } from '@shared/schema';
import { authFetch } from '@/lib/api';

interface ConsumptionWithItems extends Consumption {
  items: ConsumptionItemWithProduct[];
}

interface ConsumptionItemWithProduct extends ConsumptionItem {
  productName?: string;
}

export function MyConsumptionsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const currentDate = new Date();
  const currentMonthString = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
  const [monthFilter, setMonthFilter] = useState<string>(currentMonthString);
  const [consumptions, setConsumptions] = useState<Consumption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConsumption, setSelectedConsumption] = useState<ConsumptionWithItems | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Fetch user's own consumptions
  const fetchConsumptions = async () => {
    try {
      setLoading(true);
      // Extract month number from YYYY-MM format for API
      const monthParam = monthFilter ? monthFilter.split('-')[1] : 'all';
      const response = await authFetch(`/api/consumptions/user?search=${searchTerm}&status=${statusFilter}&type=${typeFilter}&month=${monthParam}`);
      if (!response.ok) throw new Error('Failed to fetch consumptions');
      const data = await response.json();
      setConsumptions(data);
    } catch (error) {
      console.error('Error fetching consumptions:', error);
      toast({
        title: "Errorea",
        description: "Kontsumoak kargatzean errorea gertatu da",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch consumption details
  const fetchConsumptionDetails = async (consumptionId: string) => {
    try {
      setDetailsLoading(true);
      const response = await authFetch(`/api/consumptions/${consumptionId}/items`);
      if (!response.ok) throw new Error('Failed to fetch consumption details');
      const items = await response.json();
      
      const consumption = consumptions.find(c => c.id === consumptionId);
      if (consumption) {
        setSelectedConsumption({
          ...consumption,
          items
        });
      }
    } catch (error) {
      console.error('Error fetching consumption details:', error);
      toast({
        title: "Errorea",
        description: "Kontsumoaren xehetasunak kargatzean errorea gertatu da",
        variant: "destructive",
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    fetchConsumptions();
  }, [searchTerm, statusFilter, typeFilter, monthFilter]);

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } } = {
      open: { label: t('open'), variant: 'default' },
      closed: { label: t('closed'), variant: 'secondary' },
      cancelled: { label: t('cancelled'), variant: 'destructive' },
    };
    const statusInfo = statusMap[status] || { label: status, variant: 'outline' };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const typeLabels: Record<string, string> = {
      bar: 'Barra',
      kitchen: 'Sukaldaritza',
      event: 'Ekitaldia',
      other: 'Besteak',
    };
    const label = typeLabels[type] || type;
    return <Badge variant="outline">{label}</Badge>;
  };

  const formatDate = (date: string | Date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('eu-ES');
  };

  const formatAmount = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `${num.toFixed(2)}€`;
  };

  const totalAmount = consumptions.reduce((sum, consumption) => {
    return sum + parseFloat(consumption.totalAmount || '0');
  }, 0);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-6 bg-gray-200 rounded animate-pulse w-48"></div>
        </div>
        <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t('myConsumptions')}</h2>
        <p className="text-muted-foreground">{t('myConsumptionsDescription')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalConsumptions')}</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{consumptions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalAmount')}</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatAmount(totalAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t('pending')}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {consumptions.filter(c => c.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder={t('searchConsumptions')}
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
            <SelectItem value="open">{t('open')}</SelectItem>
            <SelectItem value="closed">{t('closed')}</SelectItem>
            <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allTypes')}</SelectItem>
            <SelectItem value="bar">Barra</SelectItem>
            <SelectItem value="kitchen">Sukaldaritza</SelectItem>
            <SelectItem value="other">Besteak</SelectItem>
          </SelectContent>
        </Select>

        <MonthGrid 
          selectedMonth={monthFilter} 
          onMonthChange={setMonthFilter}
          className="w-full sm:w-48"
        />
      </div>

      {/* Consumptions Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('date')}</TableHead>
                <TableHead>{t('type')}</TableHead>
                <TableHead className="text-right">{t('amount')}</TableHead>
                <TableHead className="text-right">{t('status')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consumptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {t('noConsumptionsFound')}
                  </TableCell>
                </TableRow>
              ) : (
                consumptions.map((consumption) => (
                  <TableRow key={consumption.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span>{formatDate(consumption.createdAt)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(consumption.type || 'other')}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatAmount(consumption.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {getStatusBadge(consumption.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchConsumptionDetails(consumption.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{t('consumptionDetails')}</DialogTitle>
                          </DialogHeader>
                          {detailsLoading ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="text-sm text-muted-foreground">{t('loading')}</div>
                            </div>
                          ) : selectedConsumption ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm text-muted-foreground">{t('date')}</p>
                                  <p className="font-medium">{formatDate(selectedConsumption.createdAt)}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">{t('totalAmount')}</p>
                                  <p className="font-medium">{formatAmount(selectedConsumption.totalAmount)}</p>
                                </div>
                              </div>
                              
                              <div>
                                <h4 className="font-medium mb-2">{t('items')}</h4>
                                <div className="space-y-2">
                                  {selectedConsumption.items.map((item) => (
                                    <div key={item.id} className="flex justify-between items-center p-2 border rounded">
                                      <div>
                                        <p className="font-medium">{item.productName || 'Produktu ezezaguna'}</p>
                                        <p className="text-sm text-muted-foreground">
                                          {item.quantity} x {formatAmount(item.unitPrice)}
                                        </p>
                                      </div>
                                      <p className="font-medium">{formatAmount(item.totalPrice)}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
