import { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n';
import { Building2, Plus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { authFetch } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

interface Society {
  id: string;
  name: string;
  alphabeticId: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  createdAt: string;
}

export function BackofficeSocietiesPage() {
  const { t } = useLanguage();
  const [societies, setSocieties] = useState<Society[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    iban: '',
    creditorId: '',
    address: '',
    phone: '',
    email: '',
    reservationPricePerMember: '25.00',
    kitchenPricePerMember: '10.00',
  });

  useEffect(() => {
    const loadSocieties = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await authFetch('/api/backoffice/societies');
        if (!response.ok) {
          throw new Error('Failed to fetch societies');
        }
        const data = await response.json();
        setSocieties(data);
      } catch (err) {
        setError('Failed to load societies');
      } finally {
        setLoading(false);
      }
    };

    loadSocieties();
  }, []);

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      setError(t('societyNameRequired'));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await authFetch('/api/backoffice/societies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(t('failedToCreateSociety'));
      }

      // Reload societies list
      const loadResponse = await authFetch('/api/backoffice/societies');
      if (loadResponse.ok) {
        const data = await loadResponse.json();
        setSocieties(data);
      }

      // Reset form and close dialog
      setFormData({
        name: '',
        iban: '',
        creditorId: '',
        address: '',
        phone: '',
        email: '',
        reservationPricePerMember: '25.00',
        kitchenPricePerMember: '10.00',
      });
      setIsCreateDialogOpen(false);
    } catch (err: any) {
      setError(t('failedToCreateSociety'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authFetch('/api/backoffice/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      document.cookie = 'backoffice-token=; path=/; max-age=0';
      window.location.reload(); // Force reload to clear state and re-render login
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8" />
              {t('allSocieties')}
            </h1>
            <p className="text-muted-foreground mt-2">{t('manageAllSocieties')}</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t('newSociety')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t('createSociety')}</DialogTitle>
                <DialogDescription>{t('createSocietyDescription')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="create-name">{t('societyName')} *</Label>
                  <Input
                    id="create-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t('societyName')}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="create-email">{t('societyEmail')}</Label>
                  <Input
                    id="create-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="society@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="create-phone">{t('societyPhone')}</Label>
                  <Input
                    id="create-phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+34 123 456 789"
                  />
                </div>
                <div>
                  <Label htmlFor="create-address">{t('societyAddress')}</Label>
                  <Input
                    id="create-address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Main Street, 123"
                  />
                </div>
                <div>
                  <Label htmlFor="create-iban">{t('societyIban')}</Label>
                  <Input
                    id="create-iban"
                    value={formData.iban}
                    onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                    placeholder="ES00 0000 0000 0000 0000 0000"
                  />
                </div>
                <div>
                  <Label htmlFor="create-creditor-id">{t('societyCreditorId')}</Label>
                  <Input
                    id="create-creditor-id"
                    value={formData.creditorId}
                    onChange={(e) => setFormData({ ...formData, creditorId: e.target.value })}
                    placeholder="ES000000000000"
                  />
                </div>
                <div>
                  <Label htmlFor="create-reservation-price">{t('reservationPricePerMember')}</Label>
                  <Input
                    id="create-reservation-price"
                    type="number"
                    step="0.01"
                    value={formData.reservationPricePerMember}
                    onChange={(e) => setFormData({ ...formData, reservationPricePerMember: e.target.value })}
                    placeholder="25.00"
                  />
                </div>
                <div>
                  <Label htmlFor="create-kitchen-price">{t('kitchenPricePerMember')}</Label>
                  <Input
                    id="create-kitchen-price"
                    type="number"
                    step="0.01"
                    value={formData.kitchenPricePerMember}
                    onChange={(e) => setFormData({ ...formData, kitchenPricePerMember: e.target.value })}
                    placeholder="10.00"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button onClick={handleCreate} disabled={isSubmitting || !formData.name.trim()}>
                  {isSubmitting ? t('creating') : t('create')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md mb-6">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {societies.map((society) => (
              <Card key={society.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {society.name}
                  </CardTitle>
                  <CardDescription>ID: {society.alphabeticId}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {society.email && (
                    <p className="text-sm text-muted-foreground">{society.email}</p>
                  )}
                  {society.phone && (
                    <p className="text-sm text-muted-foreground">{society.phone}</p>
                  )}
                  {society.address && (
                    <p className="text-sm text-muted-foreground">{society.address}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Created: {new Date(society.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && !error && societies.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">{t('noResults')}</h3>
            <p className="text-muted-foreground">{t('noSocietiesFound')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
