import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
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
import type { SepaMode } from "@shared/schema";

interface Credit {
  id: string;
  memberId: string;
  memberName: string;
  iban: string | null;
  amount: number;
  selected: boolean;
  status: string;
  creditIds?: string[];
  months?: string[];
}

interface SocietyRow {
  name: string;
  iban: string | null;
  creditorId: string | null;
  sepaMode: SepaMode | string | null;
}

interface PeriodOption {
  key: string;
  label: string;
  months: string[];
}

function padMonth(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, "0")}`;
}

function lastClosedMonth(now: Date): { y: number; m: number } {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

function buildMonthlyOptions(now: Date, monthNames: string[], count: number): PeriodOption[] {
  const out: PeriodOption[] = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const ml = padMonth(y, m);
    out.push({ key: ml, label: `${ml} (${monthNames[m - 1]})`, months: [ml] });
  }
  return out;
}

function bimonthPairStart(month: number): number {
  return month % 2 === 1 ? month : month - 1;
}

function prevBimonthPair(y: number, pairStart: number): { y: number; pairStart: number } {
  if (pairStart === 1) return { y: y - 1, pairStart: 11 };
  return { y, pairStart: pairStart - 2 };
}

function buildBimonthlyOptions(now: Date, monthNames: string[], count: number): PeriodOption[] {
  const out: PeriodOption[] = [];
  const { y: startY, m } = lastClosedMonth(now);
  let y = startY;
  let pairStart = bimonthPairStart(m);
  for (let i = 0; i < count; i++) {
    const m1 = padMonth(y, pairStart);
    const m2 = padMonth(y, pairStart + 1);
    out.push({
      key: `${m1}|${m2}`,
      label: `${m1} / ${m2} (${monthNames[pairStart - 1]} / ${monthNames[pairStart]})`,
      months: [m1, m2],
    });
    const prev = prevBimonthPair(y, pairStart);
    y = prev.y;
    pairStart = prev.pairStart;
  }
  return out;
}

function quarterStartMonth(month: number): number {
  return Math.floor((month - 1) / 3) * 3 + 1;
}

function prevQuarter(y: number, qStart: number): { y: number; qStart: number } {
  if (qStart === 1) return { y: y - 1, qStart: 10 };
  return { y, qStart: qStart - 3 };
}

function buildQuarterlyOptions(now: Date, monthNames: string[], count: number): PeriodOption[] {
  const out: PeriodOption[] = [];
  const { y: startY, m } = lastClosedMonth(now);
  let y = startY;
  let qStart = quarterStartMonth(m);
  for (let i = 0; i < count; i++) {
    const m1 = padMonth(y, qStart);
    const m2 = padMonth(y, qStart + 1);
    const m3 = padMonth(y, qStart + 2);
    const qn = qStart === 1 ? 1 : qStart === 4 ? 2 : qStart === 7 ? 3 : 4;
    out.push({
      key: `${y}-Q${qn}`,
      label: `${y} Q${qn} (${monthNames[qStart - 1]}–${monthNames[qStart + 2 - 1]})`,
      months: [m1, m2, m3],
    });
    const prev = prevQuarter(y, qStart);
    y = prev.y;
    qStart = prev.qStart;
  }
  return out;
}

function buildOnDemandMonthChoices(now: Date, monthNames: string[], count: number): PeriodOption[] {
  return buildMonthlyOptions(now, monthNames, count);
}

function buildSepaExportQuery(months: string[], mode: SepaMode | string): string {
  const sorted = Array.from(new Set(months)).sort();
  if (sorted.length === 1) {
    return `month=${encodeURIComponent(sorted[0])}`;
  }
  if (mode === "on_demand") {
    return `from=${encodeURIComponent(sorted[0])}&to=${encodeURIComponent(sorted[sorted.length - 1])}`;
  }
  return `months=${sorted.map(m => encodeURIComponent(m)).join(",")}`;
}

export function SepaExportPage() {
  const { t, language } = useLanguage();
  const { toast } = useToast();

  const monthNames = useMemo(() => {
    const raw = t("sepaMonthNamesShort");
    return raw.split(",").map(s => s.trim());
  }, [t, language]);

  const [society, setSociety] = useState<SocietyRow | null>(null);
  const [loadingSociety, setLoadingSociety] = useState(true);
  const [step, setStep] = useState(1);

  const sepaMode: SepaMode | string = society?.sepaMode ?? "monthly";

  const monthlyOpts = useMemo(() => buildMonthlyOptions(new Date(), monthNames, 6), [monthNames]);
  const bimonthlyOpts = useMemo(
    () => buildBimonthlyOptions(new Date(), monthNames, 6),
    [monthNames]
  );
  const quarterlyOpts = useMemo(
    () => buildQuarterlyOptions(new Date(), monthNames, 6),
    [monthNames]
  );
  const onDemandChoices = useMemo(
    () => buildOnDemandMonthChoices(new Date(), monthNames, 24),
    [monthNames]
  );

  const periodOptions: PeriodOption[] = useMemo(() => {
    if (sepaMode === "monthly") return monthlyOpts;
    if (sepaMode === "bimonthly") return bimonthlyOpts;
    if (sepaMode === "quarterly") return quarterlyOpts;
    return monthlyOpts;
  }, [sepaMode, monthlyOpts, bimonthlyOpts, quarterlyOpts]);

  const [selectedPeriodKey, setSelectedPeriodKey] = useState("");
  const [onDemandFrom, setOnDemandFrom] = useState("");
  const [onDemandTo, setOnDemandTo] = useState("");

  useEffect(() => {
    if (periodOptions.length && !selectedPeriodKey && sepaMode !== "on_demand") {
      setSelectedPeriodKey(periodOptions[0].key);
    }
  }, [periodOptions, selectedPeriodKey, sepaMode]);

  useEffect(() => {
    if (sepaMode !== "on_demand" || onDemandChoices.length === 0) return;
    if (!onDemandFrom && onDemandChoices[2]) setOnDemandFrom(onDemandChoices[2].months[0]);
    if (!onDemandTo && onDemandChoices[1]) setOnDemandTo(onDemandChoices[1].months[0]);
  }, [sepaMode, onDemandChoices, onDemandFrom, onDemandTo]);

  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await authFetch("/api/societies/user");
        if (res.ok) {
          const data = await res.json();
          setSociety({
            name: data.name ?? "",
            iban: data.iban ?? null,
            creditorId: data.creditorId ?? null,
            sepaMode: data.sepaMode ?? "monthly",
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingSociety(false);
      }
    };
    load();
  }, []);

  const resolvedMonthLabels = useMemo(() => {
    if (sepaMode === "on_demand") {
      if (!onDemandFrom || !onDemandTo) return [];
      return expandMonthRangeInclusive(onDemandFrom, onDemandTo);
    }
    const opt = periodOptions.find(p => p.key === selectedPeriodKey);
    return opt?.months ?? [];
  }, [sepaMode, onDemandFrom, onDemandTo, periodOptions, selectedPeriodKey]);

  const fetchDebtData = async () => {
    const months = resolvedMonthLabels;
    if (!months.length) return;
    setLoading(true);
    try {
      const qs = buildSepaExportQuery(months, sepaMode);
      const response = await authFetch(`/api/credits/sepa-export?${qs}`);
      if (response.ok) {
        const data = await response.json();
        setCredits(data);
      } else {
        const errText = await response.text();
        console.error("Failed to fetch debt data", response.status, errText);
        toast({
          title: t("error"),
          description: t("sepaErrorLoadDebtData"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching debt data:", error);
      toast({
        title: t("error"),
        description: t("sepaErrorLoadDebtData"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step === 2 && society && sepaMode !== "disabled" && resolvedMonthLabels.length > 0) {
      void fetchDebtData();
    }
  }, [
    step,
    society,
    sepaMode,
    resolvedMonthLabels.join("|"),
    selectedPeriodKey,
    onDemandFrom,
    onDemandTo,
  ]);

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

  const sepaConfig = useMemo(() => {
    const name = society?.name?.trim() || defaultSepaConfig.creditorName;
    const iban = (society?.iban?.replace(/\s/g, "") || "").trim() || defaultSepaConfig.creditorIBAN;
    const cid = society?.creditorId?.trim() || "" || defaultSepaConfig.creditorId;
    return {
      creditorName: name,
      creditorIBAN: iban,
      creditorId: cid,
      creditorBIC: defaultSepaConfig.creditorBIC,
    };
  }, [society]);

  const periodLabelDisplay = (): string => {
    const m = resolvedMonthLabels;
    if (!m.length) return "";
    if (m.length === 1) return m[0];
    return `${m[0]} … ${m[m.length - 1]}`;
  };

  const handleExport = (type: "sepa" | "csv") => {
    try {
      if (type === "sepa") {
        const sepaGenerator = new SepaDirectDebitGenerator(sepaConfig);
        const executionDate = new Date();
        executionDate.setDate(executionDate.getDate() + 2);
        const m = resolvedMonthLabels;
        const slug = m.length ? `${m[0]}_${m[m.length - 1]}` : "export";
        const xml = sepaGenerator.generateXML(credits, executionDate);
        const filename = `sepa-direct-debit-${slug}-${new Date().toISOString().split("T")[0]}.xml`;
        sepaGenerator.downloadXML(xml, filename);

        toast({
          title: t("success"),
          description: t("sepaExportSuccessXml", { count: String(selectedCredits.length) }),
        });
      } else if (type === "csv") {
        const csvContent = generateCSV(selectedCredits);
        const m = resolvedMonthLabels;
        const slug = m.length ? `${m[0]}-${m[m.length - 1]}` : "export";
        downloadCSV(csvContent, `credits-${slug}.csv`);

        toast({
          title: t("success"),
          description: t("sepaExportSuccessCsv", { count: String(selectedCredits.length) }),
        });
      }
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: t("error"),
        description: String((error as Error)?.message || ""),
        variant: "destructive",
      });
    }
  };

  const generateCSV = (rows: Credit[]) => {
    const headers = ["ID", "Bazkidea", "IBAN", "Kopurua"];
    const r = rows.map(credit => [
      credit.id,
      credit.memberName,
      credit.iban || "",
      credit.amount.toFixed(2),
    ]);

    return [headers, ...r].map(row => row.join(",")).join("\n");
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

  if (loadingSociety) {
    return <div className="p-6">{t("sepaLoadingSociety")}</div>;
  }

  if (society && sepaMode === "disabled") {
    return (
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6" data-testid="sepa-export-disabled">
        <div>
          <h2 className="text-2xl font-bold">{t("sepaExport")}</h2>
          <p className="text-muted-foreground">{t("sepaExportPageDescription")}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t("sepaModeDisabled")}</CardTitle>
            <CardDescription>{t("sepaDisabledMessage")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link href="/elkartea">{t("sepaDisabledGoToSociety")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const step1Title = sepaMode === "on_demand" ? t("sepaSelectRange") : t("sepaStepSelectPeriod");

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6" data-testid="sepa-export-page">
      <div>
        <h2 className="text-2xl font-bold">{t("sepaExport")}</h2>
        <p className="text-muted-foreground">{t("sepaExportPageDescription")}</p>
      </div>

      <div className="flex items-center gap-4 mb-6 flex-wrap">
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
              {s === 1
                ? step1Title
                : s === 2
                  ? t("sepaSelectDebitsTitle")
                  : t("sepaExportStep3Title")}
            </span>
            {s < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>1. {step1Title}</CardTitle>
            <CardDescription>{t("sepaBillingPeriod")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sepaMode === "on_demand" ? (
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="space-y-2">
                  <span className="text-sm font-medium">{t("sepaFromMonth")}</span>
                  <Select value={onDemandFrom} onValueChange={setOnDemandFrom}>
                    <SelectTrigger className="w-64" data-testid="select-sepa-from-month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {onDemandChoices.map(o => (
                        <SelectItem key={o.key} value={o.months[0]}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium">{t("sepaToMonth")}</span>
                  <Select value={onDemandTo} onValueChange={setOnDemandTo}>
                    <SelectTrigger className="w-64" data-testid="select-sepa-to-month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {onDemandChoices.map(o => (
                        <SelectItem key={`to-${o.key}`} value={o.months[0]}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <Select value={selectedPeriodKey} onValueChange={setSelectedPeriodKey}>
                <SelectTrigger className="w-full max-w-md" data-testid="select-export-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map(opt => (
                    <SelectItem key={opt.key} value={opt.key}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  if (sepaMode === "on_demand") {
                    if (!onDemandFrom || !onDemandTo) {
                      toast({
                        title: t("error"),
                        description: t("sepaSelectRange"),
                        variant: "destructive",
                      });
                      return;
                    }
                    if (onDemandFrom.localeCompare(onDemandTo) > 0) {
                      toast({
                        title: t("error"),
                        description: t("sepaSelectRange"),
                        variant: "destructive",
                      });
                      return;
                    }
                  }
                  setStep(2);
                }}
                disabled={sepaMode === "on_demand" && (!onDemandFrom || !onDemandTo)}
                data-testid="button-next-step"
              >
                {t("next")}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>2. {t("sepaSelectDebitsTitle")}</CardTitle>
            <CardDescription>{t("sepaSelectDebitsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-muted-foreground">{t("sepaLoadingCredits")}</div>
              </div>
            ) : (
              <>
                {invalidCredits.length > 0 && (
                  <div className="flex items-start gap-2 p-3 mb-4 rounded-md bg-destructive/10 text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">{t("sepaInvalidIbanUsers")}</p>
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
                            checked={
                              credits.filter(c => c.iban).length > 0 &&
                              selectedCredits.length === credits.filter(c => c.iban).length
                            }
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
                                {t("sepaMissingIbanBadge")}
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
                      {t("sepaSelectedCountLabel")}: {selectedCredits.length}
                    </p>
                    <p className="text-lg font-bold">
                      {t("total")}: {totalAmount.toFixed(2)}€
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      {t("previous")}
                    </Button>
                    <Button
                      onClick={() => setStep(3)}
                      disabled={selectedCredits.length === 0}
                      data-testid="button-next-step-2"
                    >
                      {t("next")}
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
              3. {t("sepaExportStep3Title")}
            </CardTitle>
            <CardDescription>{t("sepaExportStep3Description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 rounded-md bg-muted/50">
                <p className="text-sm text-muted-foreground">{t("sepaBillingPeriod")}</p>
                <p className="text-lg font-bold">{periodLabelDisplay()}</p>
              </div>
              <div className="p-4 rounded-md bg-muted/50">
                <p className="text-sm text-muted-foreground">{t("sepaDebitCount")}</p>
                <p className="text-lg font-bold">{selectedCredits.length}</p>
              </div>
              <div className="p-4 rounded-md bg-muted/50">
                <p className="text-sm text-muted-foreground">{t("total")}</p>
                <p className="text-lg font-bold">{totalAmount.toFixed(2)}€</p>
              </div>
            </div>

            <div className="p-4 rounded-md border bg-card">
              <h4 className="font-medium mb-2">{t("sepaFileDataTitle")}</h4>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p>{t("sepaFormatPain")}</p>
                <p>
                  {t("sepaCreditorLabel")}: {sepaConfig.creditorName}
                </p>
                <p>Creditor ID: {sepaConfig.creditorId}</p>
                {(!society?.iban?.trim() || !society?.creditorId?.trim()) && (
                  <p className="text-amber-700 dark:text-amber-400">
                    {t("sepaInvalidIbanWarning")}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                {t("previous")}
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleExport("csv")}
                  data-testid="button-export-csv"
                >
                  <Download className="mr-2 h-4 w-4" />
                  CSV
                </Button>
                <Button onClick={() => handleExport("sepa")} data-testid="button-export-sepa">
                  <Download className="mr-2 h-4 w-4" />
                  SEPA XML
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function expandMonthRangeInclusive(from: string, to: string): string[] {
  const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!MONTH_RE.test(from) || !MONTH_RE.test(to)) return [];
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const start = fy * 12 + fm;
  const end = ty * 12 + tm;
  if (start > end) return [];
  const out: string[] = [];
  let y = fy;
  let m = fm;
  while (y * 12 + m <= end) {
    out.push(padMonth(y, m));
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}
