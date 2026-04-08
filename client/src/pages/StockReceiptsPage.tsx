import { useCallback, useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Link } from "wouter";
import { ChevronLeft, Eye, Plus, Search, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { ErrorFallback } from "@/components/ErrorBoundary";
import { AccessDeniedOrError } from "@/components/AccessDeniedOrError";
import { getErrorMessage } from "@/lib/errors";
import MonthGrid from "@/components/MonthGrid";

const authFetch = async (url: string, options: globalThis.RequestInit = {}) => {
  const token = localStorage.getItem("auth:token");
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };
  return fetch(url, { ...options, headers });
};

type ReceiptRow = {
  id: string;
  receivedAt: string;
  supplier: string | null;
  invoiceReference: string | null;
  lineCount: number;
};

type ReceiptLineDetail = {
  id: string;
  receiptId: string;
  productId: string;
  quantity: number;
  unitCost: string | null;
  productName: string;
  productUnit: string;
};

type ReceiptDetail = {
  id: string;
  societyId: string;
  supplier: string | null;
  invoiceReference: string | null;
  notes: string | null;
  receivedAt: string;
  createdBy: string;
  createdAt: string;
  lines: ReceiptLineDetail[];
};

type ProductOption = { id: string; name: string; unit: string };

type LineForm = { productId: string; quantity: string; unitCost: string };

export function StockReceiptsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineForm[]>([{ productId: "", quantity: "1", unitCost: "" }]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReceiptDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState("");
  const [supplierListFilter, setSupplierListFilter] = useState("");
  const [referenceListFilter, setReferenceListFilter] = useState("");

  const loadReceipts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100", page: "1" });
      if (monthFilter) params.set("month", monthFilter);
      if (supplierListFilter.trim()) params.set("supplier", supplierListFilter.trim());
      if (referenceListFilter.trim()) params.set("reference", referenceListFilter.trim());
      const res = await authFetch(`/api/stock-receipts?${params.toString()}`);
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.message || "Failed to load receipts");
      }
      const body = (await res.json()) as { data: ReceiptRow[] };
      setReceipts(body.data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [monthFilter, supplierListFilter, referenceListFilter]);

  const loadProducts = useCallback(async () => {
    const res = await authFetch("/api/products");
    if (res.ok) {
      const data = (await res.json()) as ProductOption[];
      setProducts(data.filter(p => p.id));
    }
  }, []);

  useEffect(() => {
    void loadReceipts();
  }, [loadReceipts]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const productSelectOptions = useMemo(
    () => products.map(p => ({ value: p.id, label: p.name })),
    [products]
  );

  const receiptFiltersActive = useMemo(
    () => Boolean(monthFilter || supplierListFilter.trim() || referenceListFilter.trim()),
    [monthFilter, supplierListFilter, referenceListFilter]
  );

  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    void (async () => {
      try {
        const res = await authFetch(`/api/stock-receipts/${detailId}`);
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          throw new Error(b.message || "Failed to load receipt");
        }
        const data = (await res.json()) as ReceiptDetail;
        if (!cancelled) {
          setDetail(data);
        }
      } catch (e) {
        if (!cancelled) {
          setDetailError(getErrorMessage(e));
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailId]);

  const addLine = () => {
    setLines([...lines, { productId: "", quantity: "1", unitCost: "" }]);
  };

  const removeLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const submitReceipt = async () => {
    const parsedLines = lines
      .filter(l => l.productId && l.quantity)
      .map(l => ({
        productId: l.productId,
        quantity: parseInt(l.quantity, 10),
        ...(l.unitCost.trim() ? { unitCost: l.unitCost.trim() } : {}),
      }));

    if (parsedLines.some(l => Number.isNaN(l.quantity) || l.quantity < 1)) {
      toast({
        title: t("error"),
        description: t("stockReceiptInvalidLines"),
        variant: "destructive",
      });
      return;
    }

    if (parsedLines.length === 0) {
      toast({
        title: t("error"),
        description: t("stockReceiptNeedLine"),
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await authFetch("/api/stock-receipts", {
        method: "POST",
        body: JSON.stringify({
          supplier: supplier.trim() || undefined,
          invoiceReference: invoiceRef.trim() || undefined,
          notes: notes.trim() || undefined,
          lines: parsedLines,
        }),
      });

      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.message || "Save failed");
      }

      toast({ title: t("stockReceiptCreated") });
      setDialogOpen(false);
      setSupplier("");
      setInvoiceRef("");
      setNotes("");
      setLines([{ productId: "", quantity: "1", unitCost: "" }]);
      await loadReceipts();
    } catch (e) {
      toast({
        title: t("error"),
        description: getErrorMessage(e),
        variant: "destructive",
      });
    }
  };

  if (error && !loading) {
    return <AccessDeniedOrError error={error} cardLayout />;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="p-4 sm:p-6 space-y-6" data-testid="page-stock-receipts">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
              <Link href="/produktuak">
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t("products")}
              </Link>
            </Button>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Truck className="h-7 w-7" />
              {t("supplies")}
            </h2>
            <p className="text-muted-foreground">{t("suppliesDescription")}</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-stock-receipt">
                <Plus className="mr-2 h-4 w-4" />
                {t("newSupply")}
              </Button>
            </DialogTrigger>
            <DialogContent className="flex max-h-[min(90vh,900px)] w-[calc(100vw-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[min(85vh,880px)]">
              <DialogHeader className="shrink-0 space-y-1.5 border-b border-border/60 bg-muted/15 px-6 py-4 pr-14 text-left">
                <DialogTitle>{t("newSupply")}</DialogTitle>
                <DialogDescription>{t("newSupplyDescription")}</DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t("supplier")}</Label>
                      <Input
                        value={supplier}
                        onChange={e => setSupplier(e.target.value)}
                        data-testid="input-receipt-supplier"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("invoiceReference")}</Label>
                      <Input
                        value={invoiceRef}
                        onChange={e => setInvoiceRef(e.target.value)}
                        data-testid="input-receipt-invoice"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("notes")}</Label>
                    <Input value={notes} onChange={e => setNotes(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label className="text-sm font-medium">{t("receiptLines")}</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addLine}>
                        {t("addLine")}
                      </Button>
                    </div>
                    <div className="overflow-hidden rounded-md border border-border/80">
                      <Table className="table-fixed">
                        <colgroup>
                          <col />
                          <col className="w-[7rem]" />
                          <col className="w-[5.75rem]" />
                          <col className="w-10" />
                        </colgroup>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="h-9 min-w-0 px-2 py-2 text-xs font-medium">
                              {t("product")}
                            </TableHead>
                            <TableHead className="h-9 w-[7rem] px-2 py-2 text-xs font-medium">
                              {t("quantity")}
                            </TableHead>
                            <TableHead className="h-9 w-[5.75rem] px-2 py-2 text-xs font-medium">
                              {t("unitCost")}
                            </TableHead>
                            <TableHead className="h-9 w-10 px-1 py-2">
                              <span className="sr-only">{t("removeLine")}</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lines.map((line, idx) => (
                            <TableRow
                              key={idx}
                              className="hover:bg-transparent"
                              data-testid={`receipt-line-${idx}`}
                            >
                              <TableCell className="min-w-0 p-2 align-middle">
                                <SearchableSelect
                                  id={`receipt-product-${idx}`}
                                  options={productSelectOptions}
                                  value={line.productId || undefined}
                                  onValueChange={v => {
                                    const next = [...lines];
                                    next[idx] = { ...next[idx], productId: v };
                                    setLines(next);
                                  }}
                                  placeholder={t("selectProduct")}
                                  searchPlaceholder={t("search")}
                                  emptyMessage={t("noResults")}
                                  aria-label={t("selectProduct")}
                                  data-testid={`select-receipt-product-${idx}`}
                                  minPopoverWidth={360}
                                />
                              </TableCell>
                              <TableCell className="w-[7rem] max-w-[7rem] p-2 align-middle">
                                <Input
                                  type="number"
                                  min={1}
                                  className="h-9 w-full min-w-0 tabular-nums"
                                  value={line.quantity}
                                  onChange={e => {
                                    const next = [...lines];
                                    next[idx] = { ...next[idx], quantity: e.target.value };
                                    setLines(next);
                                  }}
                                  data-testid={`input-receipt-qty-${idx}`}
                                />
                              </TableCell>
                              <TableCell className="w-[5.75rem] max-w-[5.75rem] p-2 align-middle">
                                <Input
                                  className="h-9 w-full min-w-0 tabular-nums"
                                  value={line.unitCost}
                                  onChange={e => {
                                    const next = [...lines];
                                    next[idx] = { ...next[idx], unitCost: e.target.value };
                                    setLines(next);
                                  }}
                                  placeholder="0.00"
                                />
                              </TableCell>
                              <TableCell className="w-10 p-1 align-middle">
                                {lines.length > 1 ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                    aria-label={t("removeLine")}
                                    onClick={() => removeLine(idx)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <span className="inline-block h-8 w-8" aria-hidden />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="shrink-0 gap-2 border-t border-border/60 bg-muted/10 px-6 py-4 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button onClick={() => void submitReceipt()} data-testid="button-save-receipt">
                  {t("save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-muted/30 p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[12rem] space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("month")}</Label>
            <MonthGrid
              selectedMonth={monthFilter || undefined}
              onMonthChange={setMonthFilter}
              className="w-full min-w-[12rem] sm:w-48"
              mode="past"
              yearRange={{ past: 8, future: 0 }}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5 sm:min-w-[12rem]">
            <Label className="text-xs text-muted-foreground" htmlFor="filter-receipt-supplier">
              {t("supplier")}
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="filter-receipt-supplier"
                value={supplierListFilter}
                onChange={e => setSupplierListFilter(e.target.value)}
                placeholder={t("search")}
                className="pl-9"
                data-testid="filter-receipt-supplier"
              />
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5 sm:min-w-[12rem]">
            <Label className="text-xs text-muted-foreground" htmlFor="filter-receipt-reference">
              {t("invoiceReference")}
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="filter-receipt-reference"
                value={referenceListFilter}
                onChange={e => setReferenceListFilter(e.target.value)}
                placeholder={t("search")}
                className="pl-9"
                data-testid="filter-receipt-reference"
              />
            </div>
          </div>
        </div>

        <Card className="overflow-hidden">
          <Table data-testid="table-stock-receipts">
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("supplier")}</TableHead>
                <TableHead>{t("invoiceReference")}</TableHead>
                <TableHead className="text-right">{t("receiptLineCount")}</TableHead>
                <TableHead className="text-right w-14">
                  <span className="sr-only">{t("openDetail")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {t("loading")}…
                  </TableCell>
                </TableRow>
              ) : receipts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {receiptFiltersActive ? t("noResults") : t("noStockReceipts")}
                  </TableCell>
                </TableRow>
              ) : (
                receipts.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.receivedAt).toLocaleString()}</TableCell>
                    <TableCell>{r.supplier ?? "—"}</TableCell>
                    <TableCell>{r.invoiceReference ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.lineCount}</TableCell>
                    <TableCell className="text-right p-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={t("openDetail")}
                        data-testid={`button-stock-receipt-detail-${r.id}`}
                        onClick={() => setDetailId(r.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        <Dialog
          open={detailId !== null}
          onOpenChange={open => {
            if (!open) {
              setDetailId(null);
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("stockReceiptDetails")}</DialogTitle>
            </DialogHeader>
            {detailLoading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t("loading")}…</p>
            ) : detailError ? (
              <p className="text-sm text-destructive py-4">{t("stockReceiptDetailsLoadFailed")}</p>
            ) : detail ? (
              <div className="space-y-4">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">{t("date")}</dt>
                    <dd>{new Date(detail.receivedAt).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("supplier")}</dt>
                    <dd>{detail.supplier ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("invoiceReference")}</dt>
                    <dd>{detail.invoiceReference ?? "—"}</dd>
                  </div>
                  {detail.notes?.trim() ? (
                    <div className="sm:col-span-2">
                      <dt className="text-muted-foreground">{t("notes")}</dt>
                      <dd className="whitespace-pre-wrap">{detail.notes}</dd>
                    </div>
                  ) : null}
                </dl>
                <div>
                  <p className="text-sm font-medium mb-2">{t("receiptLines")}</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("product")}</TableHead>
                        <TableHead>{t("unit")}</TableHead>
                        <TableHead className="text-right">{t("quantity")}</TableHead>
                        <TableHead className="text-right">{t("unitCost")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.lines.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            —
                          </TableCell>
                        </TableRow>
                      ) : (
                        detail.lines.map(line => (
                          <TableRow
                            key={line.id}
                            data-testid={`stock-receipt-detail-line-${line.id}`}
                          >
                            <TableCell>{line.productName}</TableCell>
                            <TableCell>{line.productUnit}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {line.quantity}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {line.unitCost?.trim() ? line.unitCost : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
