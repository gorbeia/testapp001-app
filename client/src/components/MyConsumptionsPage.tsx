import { useState, useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
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
import { ErrorFallback } from '@/components/ErrorBoundary';
import { ErrorDisplay } from '@/components/ErrorDisplay';

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
  
  // URL state management
  const [monthFilter, setMonthFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('month') || '';
    }
    return '';
  });
  const [consumptions, setConsumptions] = useState<Consumption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedConsumption, setSelectedConsumption] = useState<ConsumptionWithItems | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (monthFilter) params.set('month', monthFilter);
    
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    if (newUrl !== window.location.pathname + window.location.search) {
      window.history.replaceState({}, '', newUrl);
    }
  }, [monthFilter]);

  // Fetch user's own consumptions
  const fetchConsumptions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (monthFilter) {
        // Extract month number from YYYY-MM format for API
        const monthParam = monthFilter.split('-')[1];
        params.append('month', monthParam);
      }
      
      const response = await authFetch(`/api/consumptions/user?${params}`);
      if (!response.ok) throw new Error('Failed to fetch consumptions');
      const data = await response.json();
      setConsumptions(data);
    } catch (error) {
      console.error('Error fetching consumptions:', error);
      setError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
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
  }, [searchTerm, monthFilter]);

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

  if (isInitialLoad && loading) {
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

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
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
              {consumptions.filter(c => !c.closedAt).length}
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
                <TableHead className="text-right">{t('amount')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consumptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
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
                    <TableCell className="text-right font-medium">
                      {formatAmount(consumption.totalAmount)}
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
    </ErrorBoundary>
  );
}
