import { useCallback, useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Link } from "wouter";
import { ChevronLeft, Eye, Plus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ErrorDisplay } from "@/components/ErrorBoundary";
import { getErrorMessage } from "@/lib/errors";

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

  const loadReceipts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/stock-receipts?limit=100&page=1");
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
  }, []);

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
    return <ErrorDisplay error={error} />;
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
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("newSupply")}</DialogTitle>
                <DialogDescription>{t("newSupplyDescription")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>{t("receiptLines")}</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addLine}>
                      {t("addLine")}
                    </Button>
                  </div>
                  {lines.map((line, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-end border rounded-md p-3"
                      data-testid={`receipt-line-${idx}`}
                    >
                      <div className="col-span-12 sm:col-span-5 space-y-1">
                        <Label className="text-xs">{t("product")}</Label>
                        <Select
                          value={line.productId || undefined}
                          onValueChange={v => {
                            const next = [...lines];
                            next[idx] = { ...next[idx], productId: v };
                            setLines(next);
                          }}
                        >
                          <SelectTrigger data-testid={`select-receipt-product-${idx}`}>
                            <SelectValue placeholder={t("selectProduct")} />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-4 sm:col-span-2 space-y-1">
                        <Label className="text-xs">{t("quantity")}</Label>
                        <Input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={e => {
                            const next = [...lines];
                            next[idx] = { ...next[idx], quantity: e.target.value };
                            setLines(next);
                          }}
                          data-testid={`input-receipt-qty-${idx}`}
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-3 space-y-1">
                        <Label className="text-xs">{t("unitCost")}</Label>
                        <Input
                          value={line.unitCost}
                          onChange={e => {
                            const next = [...lines];
                            next[idx] = { ...next[idx], unitCost: e.target.value };
                            setLines(next);
                          }}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-2 flex justify-end">
                        {lines.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLine(idx)}
                          >
                            {t("removeLine")}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    {t("cancel")}
                  </Button>
                  <Button onClick={() => void submitReceipt()} data-testid="button-save-receipt">
                    {t("save")}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
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
                    {t("noStockReceipts")}
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
                          <TableRow key={line.id} data-testid={`stock-receipt-detail-line-${line.id}`}>
                            <TableCell>{line.productName}</TableCell>
                            <TableCell>{line.productUnit}</TableCell>
                            <TableCell className="text-right tabular-nums">{line.quantity}</TableCell>
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
