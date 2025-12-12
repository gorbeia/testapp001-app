import { CreditCard, TrendingUp, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MonthGrid from '@/components/MonthGrid';
import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { Credit } from '@shared/schema';

// API function to fetch current user's credits
const fetchMyCredits = async (filters?: { month?: string; status?: string }) => {
  const params = new URLSearchParams();
  if (filters?.month) params.append('month', filters.month);
  if (filters?.status) params.append('status', filters.status);
  
  const response = await fetch(`/api/credits/member/current?${params}`);
  if (!response.ok) throw new Error('Failed to fetch my credits');
  return response.json();
};

export function MyDebtsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // Fetch current user's credits
  const { data: credits = [], isLoading, error } = useQuery({
    queryKey: ['my-credits', selectedMonth],
    queryFn: () => fetchMyCredits(selectedMonth ? { month: selectedMonth } : undefined),
    enabled: !!user
  });

  // Show error state if API call fails
  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Errorea</h1>
          <p className="text-gray-600">Zure zorrak kargatzean errorea bat gertatu da. Mesedez, saiatu berriz geroago.</p>
          {process.env.NODE_ENV === 'development' && (
            <p className="text-sm text-gray-500 mt-2">Error: {error.message}</p>
          )}
        </div>
      </div>
    );
  }

  // Calculate totals from real data
  const totalPending = credits
    .filter((c: Credit) => c.status === 'pending')
    .reduce((sum: number, c: Credit) => sum + parseFloat(c.totalAmount || '0'), 0);

  const totalPaid = credits
    .filter((c: Credit) => c.status === 'paid')
    .reduce((sum: number, c: Credit) => sum + parseFloat(c.totalAmount || '0'), 0);

  // Calculate current date for filtering
  const currentDate = new Date();
  const currentMonthString = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
  
  // Get current month debt specifically
  const currentMonthDebt = credits.find((credit: Credit) => credit.month === currentMonthString);

  if (!user) {
    return (
      <div className="p-4 sm:p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Saioa hasi behar duzu</h1>
          <p className="text-gray-600">Zure zorrak ikusteko, saioa hasi behar duzu.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6" data-testid="my-debts-page">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" data-testid="my-debts-page-title">
            {t('myDebts')}
          </h2>
          <p className="text-muted-foreground" data-testid="my-debts-page-subtitle">
            {t('yourAccumulatedDebts')}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-pending">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t('pending')}</CardTitle>
            <CreditCard className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="total-pending">
              {totalPending.toFixed(2)}€
            </div>
            {currentMonthDebt && (
              <div className="text-sm text-muted-foreground mt-2" data-testid="current-month-debt">
                {t('currentMonth')}: {currentMonthDebt.totalAmount || '0'}€
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-paid">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t('paid')}</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="total-paid">
              {totalPaid.toFixed(2)}€
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-total">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t('total')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="total-debt">
              {(totalPending + totalPaid).toFixed(2)}€
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        {/* Month Grid Selector */}
        <div className="w-full sm:w-48">
          <MonthGrid 
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
          />
        </div>
        
        {/* Status Filter */}
        <Select defaultValue="all">
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
        <Table data-testid="my-debts-table">
          <TableHeader>
            <TableRow>
              <TableHead>{t('month')}</TableHead>
              <TableHead className="text-right">{t('amount')}</TableHead>
              <TableHead className="text-right">{t('status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {credits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground" data-testid="no-results-message">
                  {isLoading ? 'Loading...' : (t('noResults') || 'No results')}
                </TableCell>
              </TableRow>
            ) : (
              credits.map((credit: Credit) => (
                <TableRow key={credit.id} data-testid={`row-my-debt-${credit.id}`}>
                  <TableCell data-testid={`my-debt-month-${credit.id}`}>{credit.month}</TableCell>
                  <TableCell className="text-right font-medium" data-testid={`my-debt-amount-${credit.id}`}>{parseFloat(credit.totalAmount || '0').toFixed(2)}€</TableCell>
                  <TableCell className="text-right" data-testid={`my-debt-status-${credit.id}`}>
                    <Badge variant={credit.status === 'paid' ? 'default' : 'destructive'}>
                      {credit.status === 'paid' ? t('paid') : t('pending')}
                    </Badge>
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
