import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import { useLanguage } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Search, Plus, Edit, Trash2, CreditCard, Calendar, Settings } from 'lucide-react';
import { ErrorFallback } from '@/components/ErrorBoundary';
import { ErrorDisplay } from '@/components/ErrorDisplay';

// API function to fetch subscription types
const fetchSubscriptionTypes = async () => {
  const response = await authFetch('/api/subscription-types');
  if (!response.ok) throw new Error('Failed to fetch subscription types');
  return response.json();
};

// API function to create subscription type
const createSubscriptionType = async (data: any) => {
  const response = await authFetch('/api/subscription-types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create subscription type');
  return response.json();
};

// API function to update subscription type
const updateSubscriptionType = async (id: string, data: any) => {
  const response = await authFetch(`/api/subscription-types/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update subscription type');
  return response.json();
};

// API function to delete subscription type
const deleteSubscriptionType = async (id: string) => {
  const response = await authFetch(`/api/subscription-types/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete subscription type');
  return response.json();
};

type SubscriptionType = {
  id: string;
  name: string;
  description: string | null;
  amount: string;
  period: string;
  periodMonths: number;
  isActive: boolean;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
};

export function SubscriptionsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionType | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: '',
    period: 'monthly',
    periodMonths: 12,
    isActive: true,
    autoRenew: false,
  });

  // Fetch subscription types
  const { data: subscriptionTypes = [], isLoading, error } = useQuery({
    queryKey: ['subscription-types'],
    queryFn: fetchSubscriptionTypes,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createSubscriptionType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-types'] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: t('success'),
        description: t('subscriptionTypeCreated'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error.message || t('failedToCreateSubscriptionType'),
        variant: 'destructive',
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateSubscriptionType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-types'] });
      setIsEditDialogOpen(false);
      setEditingSubscription(null);
      resetForm();
      toast({
        title: t('success'),
        description: t('subscriptionTypeUpdated'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error.message || t('failedToUpdateSubscriptionType'),
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteSubscriptionType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-types'] });
      toast({
        title: t('success'),
        description: t('subscriptionTypeDeleted'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error.message || t('failedToDeleteSubscriptionType'),
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      amount: '',
      period: 'monthly',
      periodMonths: 12,
      isActive: true,
      autoRenew: false,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSubscription) {
      updateMutation.mutate({ id: editingSubscription.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (subscription: SubscriptionType) => {
    setEditingSubscription(subscription);
    setFormData({
      name: subscription.name,
      description: subscription.description || '',
      amount: subscription.amount,
      period: subscription.period,
      periodMonths: subscription.periodMonths,
      isActive: subscription.isActive,
      autoRenew: subscription.autoRenew,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm(t('confirmDeleteSubscriptionType'))) {
      deleteMutation.mutate(id);
    }
  };

  const filteredSubscriptions = subscriptionTypes.filter((subscription: SubscriptionType) => {
    const matchesSearch = subscription.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (subscription.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    const matchesPeriod = periodFilter === 'all' || subscription.period === periodFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && subscription.isActive) ||
                         (statusFilter === 'inactive' && !subscription.isActive);
    
    return matchesSearch && matchesPeriod && matchesStatus;
  });

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case 'monthly': return t('monthly');
      case 'quarterly': return t('quarterly');
      case 'yearly': return t('yearly');
      case 'custom': return t('custom');
      default: return period;
    }
  };

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{t('subscriptionTypes')}</h1>
            <p className="text-muted-foreground mt-1">{t('subscriptionTypesDescription')}</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                {t('newSubscriptionType')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{t('newSubscriptionType')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">{t('name')}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">{t('description')}</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="amount">{t('amount')}</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="period">{t('period')}</Label>
                  <Select value={formData.period} onValueChange={(value) => setFormData({ ...formData, period: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">{t('monthly')}</SelectItem>
                      <SelectItem value="quarterly">{t('quarterly')}</SelectItem>
                      <SelectItem value="yearly">{t('yearly')}</SelectItem>
                      <SelectItem value="custom">{t('custom')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.period === 'custom' && (
                  <div>
                    <Label htmlFor="periodMonths">{t('periodMonths')}</Label>
                    <Input
                      id="periodMonths"
                      type="number"
                      value={formData.periodMonths}
                      onChange={(e) => setFormData({ ...formData, periodMonths: parseInt(e.target.value) })}
                      min="1"
                      required
                    />
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                  <Label htmlFor="isActive">{t('active')}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="autoRenew"
                    checked={formData.autoRenew}
                    onCheckedChange={(checked) => setFormData({ ...formData, autoRenew: checked })}
                  />
                  <Label htmlFor="autoRenew">{t('autoRenew')}</Label>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    {t('cancel')}
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? t('creating') : t('create')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('searchSubscriptionTypes')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t('filterByPeriod')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allPeriods')}</SelectItem>
                <SelectItem value="monthly">{t('monthly')}</SelectItem>
                <SelectItem value="quarterly">{t('quarterly')}</SelectItem>
                <SelectItem value="yearly">{t('yearly')}</SelectItem>
                <SelectItem value="custom">{t('custom')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t('filterByStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allStatuses')}</SelectItem>
                <SelectItem value="active">{t('active')}</SelectItem>
                <SelectItem value="inactive">{t('inactive')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('name')}</TableHead>
                <TableHead>{t('description')}</TableHead>
                <TableHead>{t('amount')}</TableHead>
                <TableHead>{t('period')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('autoRenew')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    {t('loading')}
                  </TableCell>
                </TableRow>
              ) : filteredSubscriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    {t('noSubscriptionTypesFound')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredSubscriptions.map((subscription: SubscriptionType) => (
                  <TableRow key={subscription.id}>
                    <TableCell className="font-medium">{subscription.name}</TableCell>
                    <TableCell>{subscription.description || '-'}</TableCell>
                    <TableCell>€{subscription.amount}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getPeriodLabel(subscription.period)}
                        {subscription.period === 'custom' && ` (${subscription.periodMonths} ${t('months')})`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={subscription.isActive ? 'default' : 'secondary'}>
                        {subscription.isActive ? t('active') : t('inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={subscription.autoRenew ? 'default' : 'outline'}>
                        {subscription.autoRenew ? t('yes') : t('no')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(subscription)}>
                            <Edit className="h-4 w-4 mr-2" />
                            {t('edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(subscription.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{t('editSubscriptionType')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="edit-name">{t('name')}</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-description">{t('description')}</Label>
                <Input
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-amount">{t('amount')}</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-period">{t('period')}</Label>
                <Select value={formData.period} onValueChange={(value) => setFormData({ ...formData, period: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{t('monthly')}</SelectItem>
                    <SelectItem value="quarterly">{t('quarterly')}</SelectItem>
                    <SelectItem value="yearly">{t('yearly')}</SelectItem>
                    <SelectItem value="custom">{t('custom')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.period === 'custom' && (
                <div>
                  <Label htmlFor="edit-periodMonths">{t('periodMonths')}</Label>
                  <Input
                    id="edit-periodMonths"
                    type="number"
                    value={formData.periodMonths}
                    onChange={(e) => setFormData({ ...formData, periodMonths: parseInt(e.target.value) })}
                    min="1"
                    required
                  />
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="edit-isActive">{t('active')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-autoRenew"
                  checked={formData.autoRenew}
                  onCheckedChange={(checked) => setFormData({ ...formData, autoRenew: checked })}
                />
                <Label htmlFor="edit-autoRenew">{t('autoRenew')}</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? t('updating') : t('update')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
