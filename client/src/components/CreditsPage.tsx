import { useState } from 'react';
import { Search, CreditCard, TrendingUp, Download, CheckCircle, Calculator, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MonthGrid from '@/components/MonthGrid';
import { useLanguage } from '@/lib/i18n';
import { useAuth, hasTreasurerAccess } from '@/lib/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Credit } from '@shared/schema';

// Extended type for API responses that include memberName
type CreditWithMemberName = Credit & { memberName?: string };

// Helper function to display month in Basque
const getMonthDisplay = (monthString: string) => {
  if (!monthString) return 'Guztiak';
  const [year, month] = monthString.split('-');
  const monthNames = [
    'Urtarrila', 'Otsaila', 'Martxoa', 'Apirila', 'Maiatza', 'Ekaina',
    'Uztaila', 'Abuztua', 'Iraila', 'Urria', 'Azaroa', 'Abendua'
  ];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
};

// API functions
const fetchCredits = async (filters?: { month?: string; status?: string }) => {
  const params = new URLSearchParams();
  if (filters?.month) params.append('month', filters.month);
  if (filters?.status) params.append('status', filters.status);
  
  const response = await fetch(`/api/credits?${params}`);
  if (!response.ok) throw new Error('Failed to fetch credits');
  return response.json();
};

const fetchMemberCredits = async (memberId: string) => {
  const response = await fetch(`/api/credits/member/${memberId}`);
  if (!response.ok) throw new Error('Failed to fetch member credits');
  return response.json();
};

const calculateMonthlyDebts = async (year: number, month: number) => {
  const response = await fetch(`/api/credits/calculate/${year}/${month}`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to calculate debts');
  return response.json();
};

const updateCreditStatus = async (creditId: string, status: string, paidAmount?: string) => {
  const response = await fetch(`/api/credits/${creditId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, paidAmount }),
  });
  if (!response.ok) throw new Error('Failed to update credit status');
  return response.json();
};

export function CreditsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const currentDate = new Date();
  const currentMonthString = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
  const [monthFilter, setMonthFilter] = useState<string>(currentMonthString);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const isTreasurer = hasTreasurerAccess(user);

  const queryClient = useQueryClient();

  // Fetch credits based on user role
  const { data: credits = [], isLoading } = useQuery({
    queryKey: ['credits', monthFilter, statusFilter],
    queryFn: () => isTreasurer ? fetchCredits({ month: monthFilter, status: statusFilter !== 'all' ? statusFilter : undefined }) : fetchMemberCredits(user?.id || ''),
    enabled: !!user
  });

  // Calculate totals from real data
  const totalPending = credits
    .filter((c: CreditWithMemberName) => c.status === 'pending')
    .reduce((sum: number, c: CreditWithMemberName) => sum + parseFloat(c.totalAmount || '0'), 0);

  const totalPaid = credits
    .filter((c: CreditWithMemberName) => c.status === 'paid')
    .reduce((sum: number, c: CreditWithMemberName) => sum + parseFloat(c.totalAmount || '0'), 0);

  const filteredCredits = credits.filter((credit: CreditWithMemberName) =>
    credit.memberName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    credit.month.includes(searchTerm) ||
    credit.status.includes(searchTerm)
  );

  const handleExportCSV = () => {
    // TODO: Implement CSV export functionality
    console.log('Exporting CSV...');
  };

  const handleCalculateDebts = async () => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    try {
      await calculateMonthlyDebts(currentYear, currentMonth);
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['credits'] });
    } catch (error) {
      console.error('Failed to calculate debts:', error);
    }
  };

  const handleStatusUpdate = async (creditId: string, newStatus: string) => {
    try {
      await updateCreditStatus(creditId, newStatus);
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['credits'] });
    } catch (error) {
      console.error('Failed to update credit status:', error);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6" data-testid="credits-page">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" data-testid="credits-page-title">
            {isTreasurer ? t('allCredits') : t('myCredits')}
          </h2>
          <p className="text-muted-foreground" data-testid="credits-page-subtitle">
            {isTreasurer ? 'Kudeatu bazkideen zorrak' : 'Zure zor metatuak'}
          </p>
        </div>
        {isTreasurer && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCalculateDebts} data-testid="button-calculate-debts">
              <Calculator className="mr-2 h-4 w-4" />
              Calculate Current Month
            </Button>
            <Button variant="outline" onClick={handleExportCSV} data-testid="button-export-csv">
              <Download className="mr-2 h-4 w-4" />
              CSV {t('exportSepa')}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-pending">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t('pending')}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="total-pending">
              {totalPending.toFixed(2)}€
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-paid">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t('paid')}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary" data-testid="total-paid">
              {totalPaid.toFixed(2)}€
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-total">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t('total')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-grand">
              {(totalPending + totalPaid).toFixed(2)}€
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        {isTreasurer && (
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`${t('search')}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-credits"
            />
          </div>
        )}
        
        {/* Month Grid Selector - Inline with other filters */}
        <div className="w-full sm:w-48">
          <MonthGrid 
            selectedMonth={monthFilter} 
            onMonthChange={setMonthFilter}
          />
        </div>
        
        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40" data-testid="select-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allTime')}</SelectItem>
            <SelectItem value="pending">{t('pending')}</SelectItem>
            <SelectItem value="paid">{t('paid')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <Table data-testid="credits-table">
          <TableHeader>
            <TableRow>
              {isTreasurer && <TableHead>{t('member')}</TableHead>}
              <TableHead>{t('month')}</TableHead>
              <TableHead className="text-right">{t('amount')}</TableHead>
              <TableHead className="text-right">Status</TableHead>
              {isTreasurer && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCredits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isTreasurer ? 5 : 4} className="text-center py-8 text-muted-foreground" data-testid="no-results-message">
                  {isLoading ? 'Loading...' : (t('noResults') || 'No results')}
                </TableCell>
              </TableRow>
            ) : (
              filteredCredits.map((credit: CreditWithMemberName) => (
                <TableRow key={credit.id} data-testid={`row-credit-${credit.id}`}>
                  {isTreasurer && <TableCell className="font-medium" data-testid={`credit-member-${credit.id}`}>{credit.memberName}</TableCell>}
                  <TableCell data-testid={`credit-month-${credit.id}`}>{credit.month}</TableCell>
                  <TableCell className="text-right font-medium" data-testid={`credit-amount-${credit.id}`}>{parseFloat(credit.totalAmount || '0').toFixed(2)}€</TableCell>
                  <TableCell className="text-right" data-testid={`credit-status-${credit.id}`}>
                    <Badge variant={credit.status === 'paid' ? 'default' : 'destructive'}>
                      {credit.status === 'paid' ? t('paid') : t('pending')}
                    </Badge>
                  </TableCell>
                  {isTreasurer && (
                    <TableCell className="text-right">
                      {credit.status === 'pending' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleStatusUpdate(credit.id, 'paid')}
                        >
                          Mark Paid
                        </Button>
                      )}
                    </TableCell>
                  )}
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
