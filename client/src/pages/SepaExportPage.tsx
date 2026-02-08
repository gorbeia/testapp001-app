import { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Download,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/api";
import { SepaDirectDebitGenerator, defaultSepaConfig } from "@/lib/sepaGenerator";

interface Credit {
  id: string;
  memberId: string;
  memberName: string;
  iban: string | null;
  amount: number;
  selected: boolean;
  status: string;
}

export function SepaExportPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  // Generate previous six months (excluding current month)
  const generatePreviousSixMonths = () => {
    const months = [];
    const now = new Date();

    for (let i = 1; i <= 6; i++) {
      // Start from 1 to exclude current month
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = targetDate.getFullYear();
      const monthIndex = targetDate.getMonth(); // 0-11
      const monthNumber = monthIndex + 1; // 1-12 for human readable
      const monthString = `${year}-${monthNumber.toString().padStart(2, "0")}`;

      const monthNames = [
        "Urtarrila",
        "Otsaila",
        "Martxoa",
        "Apirila",
        "Maiatza",
        "Ekaina",
        "Uztaila",
        "Abuztua",
        "Iraila",
        "Urria",
        "Azaroa",
        "Abendua",
      ];
      const monthName = monthNames[monthIndex];

      console.log(`Month ${i}:`, {
        year: year,
        monthIndex: monthIndex,
        monthNumber: monthNumber,
        monthString: monthString,
        monthName: monthName,
      });

      months.push({
        value: monthString,
        label: `${monthString} (${monthName})`,
      });
    }

    return months;
  };

  const availableMonths = generatePreviousSixMonths();
  const [selectedMonth, setSelectedMonth] = useState(availableMonths[0]?.value || ""); // Previous month (first in list)
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch debt data for selected month
  const fetchDebtData = async (month: string) => {
    setLoading(true);
    try {
      const response = await authFetch(`/api/credits/sepa-export?month=${month}`);
      if (response.ok) {
        const data = await response.json();
        setCredits(data);
      } else {
        console.error("Failed to fetch debt data");
        toast({
          title: "Errorea",
          description: "Zorrak kargatzean errorea gertatu da",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching debt data:", error);
      toast({
        title: "Errorea",
        description: "Zorrak kargatzean errorea gertatu da",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when moving to step 2 or when month changes
  useEffect(() => {
    if (step === 2 && selectedMonth) {
      fetchDebtData(selectedMonth);
    }
  }, [step, selectedMonth]);

  const toggleCredit = (id: string) => {
    setCredits(prev => prev.map(c => (c.id === id ? { ...c, selected: !c.selected } : c)));
  };

  const selectAll = () => {
    const allValid = credits.every(c => !c.iban || c.selected);
    setCredits(prev => prev.map(c => (c.iban ? { ...c, selected: !allValid } : c)));
  };

  const selectedCredits = credits.filter(c => c.selected && c.iban);
  const totalAmount = selectedCredits.reduce((sum, c) => sum + c.amount, 0);
  const invalidCredits = credits.filter(c => !c.iban);

  const handleExport = (type: "sepa" | "csv") => {
    try {
      if (type === "sepa") {
        // Generate SEPA XML
        const sepaGenerator = new SepaDirectDebitGenerator(defaultSepaConfig);
        const executionDate = new Date();
        executionDate.setDate(executionDate.getDate() + 2); // Set execution date to 2 days from now

        const xml = sepaGenerator.generateXML(credits, executionDate);
        const filename = `sepa-direct-debit-${selectedMonth}-${new Date().toISOString().split("T")[0]}.xml`;
        sepaGenerator.downloadXML(xml, filename);

        toast({
          title: t("success"),
          description: `SEPA XML fitxategia sortuta ${selectedCredits.length} kobrantzekin`,
        });
      } else if (type === "csv") {
        // Generate CSV (placeholder for now)
        const csvContent = generateCSV(selectedCredits);
        downloadCSV(csvContent, `credits-${selectedMonth}.csv`);

        toast({
          title: t("success"),
          description: `CSV fitxategia sortuta ${selectedCredits.length} kobrantzekin`,
        });
      }
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Errorea",
        description: "Fitxategia sortzean errorea gertatu da",
        variant: "destructive",
      });
    }
  };

  const generateCSV = (credits: any[]) => {
    const headers = ["ID", "Bazkidea", "IBAN", "Kopurua"];
    const rows = credits.map(credit => [
      credit.id,
      credit.memberName,
      credit.iban || "",
      credit.amount.toFixed(2),
    ]);

    return [headers, ...rows].map(row => row.join(",")).join("\n");
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t("sepaExport")}</h2>
        <p className="text-muted-foreground">Sortu SEPA XML fitxategia banku kobrantzarako</p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s ? <CheckCircle className="h-4 w-4" /> : s}
            </div>
            <span className={`text-sm ${step >= s ? "font-medium" : "text-muted-foreground"}`}>
              {s === 1 ? "Hilabetea" : s === 2 ? "Hautaketa" : "Esportatu"}
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
                {availableMonths.map(month => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
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
              Markatu esportatu nahi dituzun kobrantzak. IBAN gabeko erabiltzaileak ezin dira
              esportatu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-muted-foreground">Zorrak kargatzen...</div>
              </div>
            ) : (
              <>
                {invalidCredits.length > 0 && (
                  <div className="flex items-start gap-2 p-3 mb-4 rounded-md bg-destructive/10 text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">IBAN gabeko erabiltzaileak:</p>
                      <p>{invalidCredits.map(c => c.memberName).join(", ")}</p>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedCredits.length === credits.filter(c => c.iban).length}
                            onCheckedChange={selectAll}
                            data-testid="checkbox-select-all"
                          />
                        </TableHead>
                        <TableHead>Bazkidea</TableHead>
                        <TableHead>IBAN</TableHead>
                        <TableHead className="text-right">{t("amount")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {credits.map(credit => (
                        <TableRow key={credit.id} className={!credit.iban ? "opacity-50" : ""}>
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
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6 pt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Hautatutakoak: {selectedCredits.length}
                    </p>
                    <p className="text-lg font-bold">
                      {t("total")}: {totalAmount.toFixed(2)}€
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Atzera
                    </Button>
                    <Button
                      onClick={() => setStep(3)}
                      disabled={selectedCredits.length === 0}
                      data-testid="button-next-step-2"
                    >
                      Hurrengoa
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
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
                <p className="text-sm text-muted-foreground">{t("month")}</p>
                <p className="text-lg font-bold">{selectedMonth}</p>
              </div>
              <div className="p-4 rounded-md bg-muted/50">
                <p className="text-sm text-muted-foreground">Kobrantza kopurua</p>
                <p className="text-lg font-bold">{selectedCredits.length}</p>
              </div>
              <div className="p-4 rounded-md bg-muted/50">
                <p className="text-sm text-muted-foreground">{t("total")}</p>
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
                <Button
                  variant="outline"
                  onClick={() => handleExport("csv")}
                  data-testid="button-export-csv"
                >
                  <Download className="mr-2 h-4 w-4" />
                  CSV Deskargatu
                </Button>
                <Button onClick={() => handleExport("sepa")} data-testid="button-export-sepa">
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
