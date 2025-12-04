import { useState } from 'react';
import { Building2, Save, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';

// todo: remove mock functionality - replace with real API data
const mockSocietyData = {
  name: 'Gure Txokoa',
  iban: 'ES91 2100 0418 4502 0005 1330',
  creditorId: 'ES45000B12345678',
  address: 'Kale Nagusia 15, 20001 Donostia',
  phone: '+34 943 111 222',
  email: 'info@guretxokoa.eus',
};

export function SocietyPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [formData, setFormData] = useState(mockSocietyData);

  const handleSave = () => {
    console.log('Saving society data:', formData);
    toast({
      title: t('success'),
      description: 'Datuak gordeta / Datos guardados',
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t('society')}</h2>
        <p className="text-muted-foreground">Elkartearen datuak eta SEPA konfigurazioa</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
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
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-society-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Helbidea / Dirección</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                data-testid="input-society-address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('phone')}</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  data-testid="input-society-phone"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('email')}</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  data-testid="input-society-email"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              SEPA Konfigurazioa
            </CardTitle>
            <CardDescription>Ordainketa zuzenerako beharrezko datuak</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('societyIban')}</Label>
              <Input
                value={formData.iban}
                onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
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
                value={formData.creditorId}
                onChange={(e) => setFormData({ ...formData, creditorId: e.target.value })}
                placeholder="ES00000X00000000"
                data-testid="input-creditor-id"
              />
              <p className="text-xs text-muted-foreground">
                SEPA hartzekodun identifikatzailea / Identificador de acreedor SEPA
              </p>
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
