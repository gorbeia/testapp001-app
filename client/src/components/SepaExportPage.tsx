import { useState } from 'react';
import { FileSpreadsheet, Download, CheckCircle, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';

// todo: remove mock functionality - replace with real API data
const mockCreditsForExport = [
  { id: '1', memberId: '1', memberName: 'Mikel Etxeberria', iban: 'ES91 2100 0418 4502 0005 1332', amount: 125.50, selected: true },
  { id: '2', memberId: '2', memberName: 'Ane Zelaia', iban: 'ES91 2100 0418 4502 0005 1333', amount: 87.00, selected: true },
  { id: '3', memberId: '3', memberName: 'Jon Agirre', iban: 'ES91 2100 0418 4502 0005 1334', amount: 210.25, selected: true },
  { id: '4', memberId: '4', memberName: 'Miren Urrutia', iban: 'ES91 2100 0418 4502 0005 1335', amount: 45.00, selected: true },
  { id: '5', memberId: '5', memberName: 'Andoni Garcia', iban: null, amount: 32.00, selected: false },
];

export function SepaExportPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState('2024-12');
  const [credits, setCredits] = useState(mockCreditsForExport);

  const toggleCredit = (id: string) => {
    setCredits((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  const selectAll = () => {
    const allValid = credits.every((c) => !c.iban || c.selected);
    setCredits((prev) =>
      prev.map((c) => (c.iban ? { ...c, selected: !allValid } : c))
    );
  };

  const selectedCredits = credits.filter((c) => c.selected && c.iban);
  const totalAmount = selectedCredits.reduce((sum, c) => sum + c.amount, 0);
  const invalidCredits = credits.filter((c) => !c.iban);

  const handleExport = () => {
    console.log('Exporting SEPA file for:', selectedCredits);
    toast({
      title: t('success'),
      description: `SEPA fitxategia sortuta ${selectedCredits.length} kobrantzekin / Archivo SEPA generado con ${selectedCredits.length} cobros`,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t('sepaExport')}</h2>
        <p className="text-muted-foreground">Sortu SEPA XML fitxategia banku kobrantzarako</p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {step > s ? <CheckCircle className="h-4 w-4" /> : s}
            </div>
            <span className={`text-sm ${step >= s ? 'font-medium' : 'text-muted-foreground'}`}>
              {s === 1 ? 'Hilabetea' : s === 2 ? 'Hautaketa' : 'Esportatu'}
            </span>
            {s < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>1. Hautatu hilabetea</CardTitle>
            <CardDescription>Zein hilabeteko zorrak esportatu nahi dituzu?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-64" data-testid="select-export-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024-12">2024-12 (Abendua)</SelectItem>
                <SelectItem value="2024-11">2024-11 (Azaroa)</SelectItem>
                <SelectItem value="2024-10">2024-10 (Urria)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} data-testid="button-next-step">
                Hurrengoa
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>2. Hautatu kobrantzak</CardTitle>
            <CardDescription>
              Markatu esportatu nahi dituzun kobrantzak. IBAN gabeko erabiltzaileak ezin dira esportatu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invalidCredits.length > 0 && (
              <div className="flex items-start gap-2 p-3 mb-4 rounded-md bg-destructive/10 text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">IBAN gabeko erabiltzaileak:</p>
                  <p>{invalidCredits.map((c) => c.memberName).join(', ')}</p>
                </div>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedCredits.length === credits.filter((c) => c.iban).length}
                      onCheckedChange={selectAll}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>Bazkidea</TableHead>
                  <TableHead>IBAN</TableHead>
                  <TableHead className="text-right">{t('amount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credits.map((credit) => (
                  <TableRow key={credit.id} className={!credit.iban ? 'opacity-50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={credit.selected}
                        onCheckedChange={() => toggleCredit(credit.id)}
                        disabled={!credit.iban}
                        data-testid={`checkbox-credit-${credit.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{credit.memberName}</TableCell>
                    <TableCell>
                      {credit.iban || (
                        <Badge variant="destructive" className="text-xs">
                          IBAN falta
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{credit.amount.toFixed(2)}€</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">Hautatutakoak: {selectedCredits.length}</p>
                <p className="text-lg font-bold">{t('total')}: {totalAmount.toFixed(2)}€</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Atzera
                </Button>
                <Button onClick={() => setStep(3)} disabled={selectedCredits.length === 0} data-testid="button-next-step-2">
                  Hurrengoa
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              3. SEPA esportazioa
            </CardTitle>
            <CardDescription>Berrikusi datuak eta deskargatu SEPA fitxategia</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 rounded-md bg-muted/50">
                <p className="text-sm text-muted-foreground">{t('month')}</p>
                <p className="text-lg font-bold">{selectedMonth}</p>
              </div>
              <div className="p-4 rounded-md bg-muted/50">
                <p className="text-sm text-muted-foreground">Kobrantza kopurua</p>
                <p className="text-lg font-bold">{selectedCredits.length}</p>
              </div>
              <div className="p-4 rounded-md bg-muted/50">
                <p className="text-sm text-muted-foreground">{t('total')}</p>
                <p className="text-lg font-bold">{totalAmount.toFixed(2)}€</p>
              </div>
            </div>

            <div className="p-4 rounded-md border bg-card">
              <h4 className="font-medium mb-2">Fitxategi datuak</h4>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p>Formatua: SEPA Direct Debit XML (pain.008.001.02)</p>
                <p>Hartzekodunak: Gure Txokoa</p>
                <p>Creditor ID: ES45000B12345678</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Atzera
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExport} data-testid="button-export-csv">
                  <Download className="mr-2 h-4 w-4" />
                  CSV Deskargatu
                </Button>
                <Button onClick={handleExport} data-testid="button-export-sepa">
                  <Download className="mr-2 h-4 w-4" />
                  SEPA XML Deskargatu
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
