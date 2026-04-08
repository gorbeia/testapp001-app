import { useCallback, useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Link } from "wouter";
import { ClipboardList, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/lib/i18n";
import { useFormattedDates } from "@/lib/date-locale";
import { ErrorFallback } from "@/components/ErrorBoundary";
import { AccessDeniedOrError } from "@/components/AccessDeniedOrError";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import PaginationControls from "@/components/PaginationControls";
import { TableFiltersBar, TableFilterField } from "@/components/TableFiltersBar";
import { usePagination } from "@/hooks/use-pagination";

const authFetch = async (url: string, options: globalThis.RequestInit = {}) => {
  const token = localStorage.getItem("auth:token");
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };
  return fetch(url, { ...options, headers });
};

export type StockMovementListRow = {
  id: string;
  productId: string;
  societyId: string;
  type: string;
  quantity: number;
  reason: string | null;
  referenceId: string | null;
  previousStock: string;
  newStock: string;
  createdBy: string;
  createdAt: string;
  productName: string | null;
  createdByName: string | null;
};

function typeBadgeVariant(type: string): "default" | "secondary" | "destructive" | "outline" {
  switch (type) {
    case "consumption":
      return "default";
    case "purchase":
      return "secondary";
    case "adjustment":
      return "outline";
    case "damage":
      return "destructive";
    default:
      return "outline";
  }
}

export function StockChangesPage() {
  const { t } = useLanguage();
  const { formatDateTime } = useFormattedDates();
  const pagination = usePagination({ initialPage: 1, initialLimit: 25 });
  const [rows, setRows] = useState<StockMovementListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [products, setProducts] = useState<{ id: string; name: string; categoryId: string }[]>([]);

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [productIdFilter, setProductIdFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const loadProducts = useCallback(async () => {
    const pRes = await authFetch("/api/products");
    if (pRes.ok) {
      const data = (await pRes.json()) as {
        id: string;
        name: string;
        categoryId: string;
      }[];
      setProducts(data);
    }
  }, []);

  const loadMovements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") {
        params.set("type", typeFilter);
      }
      if (productIdFilter !== "all") {
        params.set("productId", productIdFilter);
      }
      if (fromDate) {
        params.set("from", fromDate);
      }
      if (toDate) {
        params.set("to", toDate);
      }
      params.set("limit", String(pagination.limit));
      params.set("page", String(pagination.page));

      const res = await authFetch(`/api/stock-movements?${params.toString()}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || "Failed to load stock movements");
      }
      const body = (await res.json()) as {
        data: StockMovementListRow[];
        total: number;
      };
      setRows(body.data);
      setTotal(body.total);
      pagination.updatePagination(body.total);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [typeFilter, productIdFilter, fromDate, toDate, pagination.page, pagination.limit]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    void loadMovements();
  }, [loadMovements]);

  const tType = (type: string) => {
    switch (type) {
      case "consumption":
        return t("stockTypeConsumption");
      case "purchase":
        return t("stockTypePurchase");
      case "adjustment":
        return t("stockTypeAdjustment");
      case "damage":
        return t("stockTypeDamage");
      default:
        return type;
    }
  };

  if (error && !loading && rows.length === 0) {
    return <AccessDeniedOrError error={error} cardLayout />;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6" data-testid="page-stock-changes">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
              <Link href="/produktuak">
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t("products")}
              </Link>
            </Button>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="h-7 w-7" />
              {t("stockChanges")}
            </h2>
            <p className="text-muted-foreground">{t("stockChangesDescription")}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => void loadMovements()}
            data-testid="button-refresh-stock-log"
          >
            {t("refresh")}
          </Button>
        </div>

        <div className="space-y-2">
          <TableFiltersBar className="w-full flex-col items-stretch sm:flex-col">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
              <TableFilterField label={t("filterByType")}>
                <Select
                  value={typeFilter}
                  onValueChange={v => {
                    setTypeFilter(v);
                    pagination.setPage(1);
                  }}
                >
                  <SelectTrigger data-testid="select-stock-type-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allTypes")}</SelectItem>
                    <SelectItem value="consumption">{t("stockTypeConsumption")}</SelectItem>
                    <SelectItem value="purchase">{t("stockTypePurchase")}</SelectItem>
                    <SelectItem value="adjustment">{t("stockTypeAdjustment")}</SelectItem>
                    <SelectItem value="damage">{t("stockTypeDamage")}</SelectItem>
                  </SelectContent>
                </Select>
              </TableFilterField>
              <TableFilterField label={t("filterByProduct")}>
                <Select
                  value={productIdFilter}
                  onValueChange={v => {
                    setProductIdFilter(v);
                    pagination.setPage(1);
                  }}
                >
                  <SelectTrigger data-testid="select-stock-product-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("all")}</SelectItem>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableFilterField>
              <TableFilterField label={t("dateFrom")}>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={e => {
                    setFromDate(e.target.value);
                    pagination.setPage(1);
                  }}
                  data-testid="input-stock-from-date"
                />
              </TableFilterField>
              <TableFilterField label={t("dateTo")}>
                <Input
                  type="date"
                  value={toDate}
                  onChange={e => {
                    setToDate(e.target.value);
                    pagination.setPage(1);
                  }}
                  data-testid="input-stock-to-date"
                />
              </TableFilterField>
            </div>
          </TableFiltersBar>
          <p className="text-xs text-muted-foreground">
            {t("stockChangesTotal", { count: String(total) })}
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{getErrorMessage(error)}</p>}

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t("date")}</TableHead>
                  <TableHead scope="col">{t("product")}</TableHead>
                  <TableHead scope="col">{t("type")}</TableHead>
                  <TableHead scope="col" className="text-right">
                    {t("quantity")}
                  </TableHead>
                  <TableHead scope="col">{t("stockBeforeAfter")}</TableHead>
                  <TableHead scope="col">{t("reason")}</TableHead>
                  <TableHead scope="col">{t("user")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {t("loading")}…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {t("noStockMovements")}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map(row => (
                    <TableRow key={row.id} data-testid={`row-stock-movement-${row.id}`}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDateTime(row.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.productName ?? row.productId}
                      </TableCell>
                      <TableCell>
                        <Badge variant={typeBadgeVariant(row.type)}>{tType(row.type)}</Badge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono",
                          row.quantity < 0 && "text-destructive",
                          row.quantity > 0 && "text-green-600 dark:text-green-400"
                        )}
                      >
                        {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.previousStock} → {row.newStock}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {row.reason ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.createdByName ?? row.createdBy}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {total > 0 && (
          <PaginationControls pagination={pagination} itemType="stockMovementsForPagination" />
        )}
      </div>
    </ErrorBoundary>
  );
}
