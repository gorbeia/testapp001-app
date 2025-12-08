import { useState } from 'react';
import { Search, CreditCard, TrendingUp, Download, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/lib/i18n';
import { useAuth, hasTreasurerAccess } from '@/lib/auth';

// todo: remove mock functionality - replace with real API data
const mockCredits = [
  { id: '1', memberId: '1', memberName: 'Mikel Etxeberria', month: '2024-12', amount: 125.50, status: 'pending' },
  { id: '2', memberId: '2', memberName: 'Ane Zelaia', month: '2024-12', amount: 87.00, status: 'pending' },
  { id: '3', memberId: '3', memberName: 'Jon Agirre', month: '2024-12', amount: 210.25, status: 'pending' },
  { id: '4', memberId: '4', memberName: 'Miren Urrutia', month: '2024-12', amount: 45.00, status: 'pending' },
  { id: '5', memberId: '1', memberName: 'Mikel Etxeberria', month: '2024-11', amount: 98.00, status: 'paid' },
  { id: '6', memberId: '2', memberName: 'Ane Zelaia', month: '2024-11', amount: 156.50, status: 'paid' },
  { id: '7', memberId: '3', memberName: 'Jon Agirre', month: '2024-11', amount: 78.25, status: 'paid' },
  { id: '8', memberId: '5', memberName: 'Andoni Garcia', month: '2024-12', amount: 32.00, status: 'pending' },
];

export function CreditsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState<string>('2024-12');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const isTreasurer = hasTreasurerAccess(user);

  const filteredCredits = mockCredits.filter((c) => {
    const matchesSearch = c.memberName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMonth = !monthFilter || c.month === monthFilter;
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesUser = isTreasurer || c.memberId === user?.id;
    return matchesSearch && matchesMonth && matchesStatus && matchesUser;
  });

  const totalPending = filteredCredits
    .filter((c) => c.status === 'pending')
    .reduce((sum, c) => sum + c.amount, 0);

  const totalPaid = filteredCredits
    .filter((c) => c.status === 'paid')
    .reduce((sum, c) => sum + c.amount, 0);

  const handleExportCSV = () => {
    console.log('Exporting CSV...');
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{isTreasurer ? t('allCredits') : t('myCredits')}</h2>
          <p className="text-muted-foreground">
            {isTreasurer ? 'Kudeatu bazkideen zorrak' : 'Zure zor metatuak'}
          </p>
        </div>
        {isTreasurer && (
          <Button variant="outline" onClick={handleExportCSV} data-testid="button-export-csv">
            <Download className="mr-2 h-4 w-4" />
            CSV {t('exportSepa')}
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t('pending')}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{totalPending.toFixed(2)}€</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t('paid')}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totalPaid.toFixed(2)}€</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t('total')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(totalPending + totalPaid).toFixed(2)}€</div>
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
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-full sm:w-40" data-testid="select-month">
            <SelectValue placeholder={t('month')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2024-12">2024-12</SelectItem>
            <SelectItem value="2024-11">2024-11</SelectItem>
            <SelectItem value="2024-10">2024-10</SelectItem>
          </SelectContent>
        </Select>
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
        <Table>
          <TableHeader>
            <TableRow>
              {isTreasurer && <TableHead>{t('member')}</TableHead>}
              <TableHead>{t('month')}</TableHead>
              <TableHead className="text-right">{t('amount')}</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCredits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isTreasurer ? 4 : 3} className="text-center py-8 text-muted-foreground">
                  {t('noResults')}
                </TableCell>
              </TableRow>
            ) : (
              filteredCredits.map((credit) => (
                <TableRow key={credit.id} data-testid={`row-credit-${credit.id}`}>
                  {isTreasurer && <TableCell className="font-medium">{credit.memberName}</TableCell>}
                  <TableCell>{credit.month}</TableCell>
                  <TableCell className="text-right font-medium">{credit.amount.toFixed(2)}€</TableCell>
                  <TableCell className="text-right">
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
