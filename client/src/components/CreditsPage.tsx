import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useUrlFilter } from '@/hooks/useUrlFilter';
import { ErrorFallback } from '@/components/ErrorBoundary';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, CreditCard, TrendingUp, CheckCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import MonthGrid from '@/components/MonthGrid';
import { useLanguage } from '@/lib/i18n';
import { useAuth, hasAdminAccess } from '@/lib/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Credit } from '@shared/schema';

// Extended type for API responses that include memberName and payment tracking
type CreditWithMemberName = Credit & { 
  memberName?: string;
  markedByUser?: string;
  markedByUserName?: string;
};

// Helper function to check if credit is for current month
const isCurrentMonth = (monthString: string) => {
  const currentDate = new Date();
  const currentMonthString = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
  return monthString === currentMonthString;
};

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
  
  const token = localStorage.getItem('auth:token');
  const response = await fetch(`/api/credits?${params}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  
  if (!response.ok) {
    // Handle different error types appropriately
    if (response.status === 401) {
      throw new Error('Authentication required');
    } else if (response.status >= 500) {
      throw new Error('Server error occurred');
    } else {
      throw new Error('Failed to fetch credits');
    }
  }
  
  return response.json();
};

export function CreditsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCredits, setSelectedCredits] = useState<Set<string>>(new Set());
  const [isMarkingAsPaid, setIsMarkingAsPaid] = useState(false);
  
  // Use URL filter hook for month and status
  const currentDate = new Date();
  const currentMonthString = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
  const monthFilter = useUrlFilter({ baseUrl: '/zorrak', paramName: 'month', initialValue: '' });
  const statusFilter = useUrlFilter({ baseUrl: '/zorrak', paramName: 'status', initialValue: 'all' });

  const isAdmin = hasAdminAccess(user);

  // Redirect non-admin users
  if (user && !isAdmin) {
    return (
      <div className="p-4 sm:p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('accessDenied')}</h1>
          <p className="text-gray-600">Orri hau administratzaileentzat baino ez da eskuragarri.</p>
        </div>
      </div>
    );
  }

  const queryClient = useQueryClient();

  // Fetch all credits (admin only)
  const { data: credits = [], isLoading, error } = useQuery({
    queryKey: ['credits', monthFilter.value, statusFilter.value],
    queryFn: () => fetchCredits({ month: monthFilter.value, status: statusFilter.value !== 'all' ? statusFilter.value : undefined }),
    enabled: !!user && isAdmin
  });

  // Show error state if API call fails
  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-red-600 mb-4">{t('error')}</h1>
          <p className="text-gray-600">Zorrak kargatzean errorea bat gertatu da. Mesedez, saiatu berriz geroago.</p>
          {process.env.NODE_ENV === 'development' && (
            <p className="text-sm text-gray-500 mt-2">Error: {error.message}</p>
          )}
        </div>
      </div>
    );
  }

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

  const handleSelectCredit = (creditId: string) => {
    setSelectedCredits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(creditId)) {
        newSet.delete(creditId);
      } else {
        newSet.add(creditId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const eligibleCredits = filteredCredits.filter((credit: CreditWithMemberName) => 
      credit.status === 'pending' && !isCurrentMonth(credit.month)
    );
    
    if (selectedCredits.size === eligibleCredits.length) {
      setSelectedCredits(new Set());
    } else {
      setSelectedCredits(new Set(eligibleCredits.map((credit: CreditWithMemberName) => credit.id)));
    }
  };

  const handleMarkAsPaid = async () => {
    if (selectedCredits.size === 0) return;
    
    setIsMarkingAsPaid(true);
    try {
      const response = await fetch('/api/credits/batch-status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creditIds: Array.from(selectedCredits),
          status: 'paid'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to mark credits as paid');
      }

      // Clear selection and refresh data
      setSelectedCredits(new Set());
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      
      toast({
        title: "Eguneratuta",
        description: `${selectedCredits.size} zorrak ordaindu gisa markatu dira`,
      });
    } catch (error) {
      console.error('Error marking credits as paid:', error);
      toast({
        title: t('error'),
        description: "Zorrak markatzean errorea gertatu da",
        variant: "destructive",
      });
    } finally {
      setIsMarkingAsPaid(false);
    }
  };

  const isAllSelected = filteredCredits.filter((credit: CreditWithMemberName) => 
    credit.status === 'pending' && !isCurrentMonth(credit.month)
  ).length > 0 && selectedCredits.size === filteredCredits.filter((credit: CreditWithMemberName) => 
    credit.status === 'pending' && !isCurrentMonth(credit.month)
  ).length;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6" data-testid="credits-page">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" data-testid="credits-page-title">
            {t('allCredits')}
          </h2>
          <p className="text-muted-foreground" data-testid="credits-page-subtitle">
            {t('manageCredits')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleMarkAsPaid} 
            disabled={selectedCredits.size === 0 || isMarkingAsPaid}
            data-testid="button-mark-as-paid"
          >
            <Check className="mr-2 h-4 w-4" />
            {isMarkingAsPaid ? t('marking') : 
             selectedCredits.size === 0 ? t('selectDebtsToPay') : 
             `${t('markAsPaid')} (${selectedCredits.size})`}
          </Button>
        </div>
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
        
        {/* Month Grid Selector - Inline with other filters */}
        <div className="w-full sm:w-48">
          <MonthGrid 
            selectedMonth={monthFilter.value} 
            onMonthChange={monthFilter.setValue}
          />
        </div>
        
        {/* Status Filter */}
        <Select value={statusFilter.value} onValueChange={statusFilter.setValue}>
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
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  className="rounded"
                  data-testid="checkbox-select-all"
                />
              </TableHead>
              {isAdmin && <TableHead>{t('member')}</TableHead>}
              <TableHead>{t('month')}</TableHead>
              <TableHead className="text-right">{t('amount')}</TableHead>
              <TableHead className="text-right">{t('status')}</TableHead>
              <TableHead className="text-right">{t('payment')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCredits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-muted-foreground" data-testid="no-results-message">
                  {isLoading ? 'Loading...' : (t('noResults') || 'No results')}
                </TableCell>
              </TableRow>
            ) : (
              filteredCredits.map((credit: CreditWithMemberName) => (
                <TableRow key={credit.id} data-testid={`row-credit-${credit.id}`}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedCredits.has(credit.id)}
                      onChange={() => handleSelectCredit(credit.id)}
                      disabled={credit.status !== 'pending' || isCurrentMonth(credit.month)}
                      className="rounded"
                      data-testid={`checkbox-select-${credit.id}`}
                    />
                  </TableCell>
                  {isAdmin && <TableCell className="font-medium" data-testid={`credit-member-${credit.id}`}>{credit.memberName}</TableCell>}
                  <TableCell data-testid={`credit-month-${credit.id}`}>{credit.month}</TableCell>
                  <TableCell className="text-right font-medium" data-testid={`credit-amount-${credit.id}`}>{parseFloat(credit.totalAmount || '0').toFixed(2)}€</TableCell>
                  <TableCell className="text-right" data-testid={`credit-status-${credit.id}`}>
                    <Badge variant={credit.status === 'paid' ? 'default' : 'destructive'}>
                      {credit.status === 'paid' ? t('paid') : t('pending')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {credit.status === 'paid' && credit.markedByUserName && (
                      <div className="space-y-1">
                        <div>{credit.markedByUserName}</div>
                        {credit.markedAsPaidAt && (
                          <div className="text-muted-foreground">
                            {new Date(credit.markedAsPaidAt).toLocaleDateString('eu-ES')}
                          </div>
                        )}
                      </div>
                    )}
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
