import { useState, useEffect } from 'react';
import { Building2, Save, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';

interface Society {
  id: string;
  name: string;
  iban: string;
  creditorId: string;
  address: string;
  phone: string;
  email: string;
  reservationPricePerMember: string;
  kitchenPricePerMember: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function SocietyPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [society, setSociety] = useState<Society | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load current society from API
  useEffect(() => {
    const fetchSociety = async () => {
      try {
        const token = localStorage.getItem('auth:token');
        
        const response = await fetch('/api/societies/user', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setSociety(data);
        } else {
          const errorText = await response.text();
          console.error('API error:', response.status, errorText);
        }
      } catch (error) {
        console.error('Error fetching society:', error);
        toast({
          title: 'Error',
          description: 'Failed to load society data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSociety();
  }, [toast]);

  const handleSave = async () => {
    if (!society) return;

    try {
      const token = localStorage.getItem('auth:token');
      const { id, createdAt, updatedAt, ...updateData } = society; // Remove timestamps
      
      const response = await fetch(`/api/societies/${society.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        const savedSociety = await response.json();
        setSociety(savedSociety);
        toast({
          title: t('success'),
          description: 'Elkartearen datuak eguneratua / Datos de la sociedad actualizados',
        });
      } else {
        throw new Error('Failed to save society');
      }
    } catch (error) {
      console.error('Error saving society:', error);
      toast({
        title: 'Error',
        description: 'Failed to save society data',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!society) {
    return <div>No society data available</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t('society')}</h2>
        <p className="text-muted-foreground">Elkartearen datuak eta SEPA konfigurazioa</p>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Elkarte Datuak
            </CardTitle>
            <CardDescription>Elkartearen oinarrizko informazioa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('societyName')}</Label>
              <Input
                value={society.name}
                onChange={(e) => setSociety({ ...society, name: e.target.value })}
                data-testid="input-society-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Helbidea / Dirección</Label>
              <Input
                value={society.address}
                onChange={(e) => setSociety({ ...society, address: e.target.value })}
                data-testid="input-society-address"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('phone')}</Label>
                <Input
                  value={society.phone}
                  onChange={(e) => setSociety({ ...society, phone: e.target.value })}
                  data-testid="input-society-phone"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('email')}</Label>
                <Input
                  type="email"
                  value={society.email}
                  onChange={(e) => setSociety({ ...society, email: e.target.value })}
                  data-testid="input-society-email"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              SEPA Konfigurazioa
            </CardTitle>
            <CardDescription>{t('paymentDataRequired')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('societyIban')}</Label>
              <Input
                value={society.iban}
                onChange={(e) => setSociety({ ...society, iban: e.target.value })}
                placeholder="ES00 0000 0000 0000 0000 0000"
                data-testid="input-society-iban"
              />
              <p className="text-xs text-muted-foreground">
                Kobrantzak jasotzeko kontua / Cuenta para recibir cobros
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t('creditorId')}</Label>
              <Input
                value={society.creditorId}
                onChange={(e) => setSociety({ ...society, creditorId: e.target.value })}
                placeholder="ES00000X00000000"
                data-testid="input-creditor-id"
              />
              <p className="text-xs text-muted-foreground">
                SEPA hartzekodun identifikatzailea / Identificador de acreedor SEPA
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              {t('reservationPricing')}
            </CardTitle>
            <CardDescription>Erreserben prezioak ezartzeko</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('reservationPricePerMember')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={society.reservationPricePerMember}
                  onChange={(e) => setSociety({ ...society, reservationPricePerMember: e.target.value })}
                  data-testid="input-reservation-price-per-member"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('kitchenPricePerMember')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={society.kitchenPricePerMember}
                  onChange={(e) => setSociety({ ...society, kitchenPricePerMember: e.target.value })}
                  data-testid="input-kitchen-price-per-member"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} data-testid="button-save-society">
          <Save className="mr-2 h-4 w-4" />
          {t('save')}
        </Button>
      </div>
    </div>
  );
}
