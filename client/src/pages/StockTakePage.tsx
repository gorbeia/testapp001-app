import { useCallback, useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Link } from "wouter";
import { ChevronLeft, ClipboardCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { ErrorFallback } from "@/components/ErrorBoundary";
import { ErrorDisplay } from "@/components/ErrorBoundary";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

const authFetch = async (url: string, options: globalThis.RequestInit = {}) => {
  const token = localStorage.getItem("auth:token");
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };
  return fetch(url, { ...options, headers });
};

type TakeSummary = {
  id: string;
  date: string;
  status: "draft" | "completed" | "cancelled";
  notes: string | null;
  completedAt: string | null;
};

type TakeLine = {
  id: string;
  productId: string;
  systemStock: string;
  countedStock: string | null;
  variance: string | null;
  productName: string;
  productUnit: string;
};

export function StockTakePage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [takes, setTakes] = useState<TakeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [takeDetail, setTakeDetail] = useState<{
    take: TakeSummary;
    lines: TakeLine[];
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createNotes, setCreateNotes] = useState("");
  const [finalizeOpen, setFinalizeOpen] = useState(false);

  const loadTakes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/stock-takes?limit=100&page=1");
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.message || "Failed to load stock takes");
      }
      const body = (await res.json()) as { data: TakeSummary[] };
      setTakes(body.data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await authFetch(`/api/stock-takes/${id}`);
      if (!res.ok) {
        throw new Error("Failed to load stock take");
      }
      const body = (await res.json()) as TakeSummary & { lines: TakeLine[] };
      const { lines, ...take } = body;
      setTakeDetail({ take, lines });
    } catch (e) {
      toast({
        title: t("error"),
        description: getErrorMessage(e),
        variant: "destructive",
      });
      setSelectedId(null);
    } finally {
      setLoadingDetail(false);
    }
  }, [toast, t]);

  useEffect(() => {
    void loadTakes();
  }, [loadTakes]);

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    } else {
      setTakeDetail(null);
    }
  }, [selectedId, loadDetail]);

  const draftTake = takes.find(x => x.status === "draft");

  const startTake = async () => {
    try {
      const res = await authFetch("/api/stock-takes", {
        method: "POST",
        body: JSON.stringify({
          notes: createNotes.trim() || undefined,
        }),
      });

      if (res.status === 409) {
        const b = await res.json().catch(() => ({}));
        toast({
          title: t("error"),
          description: b.message || t("stockTakeDraftExists"),
          variant: "destructive",
        });
        if (b.draftId) {
          setSelectedId(b.draftId);
        }
        return;
      }

      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.message || "Failed");
      }

      const created = (await res.json()) as { id: string };
      toast({ title: t("stockTakeCreated") });
      setCreateOpen(false);
      setCreateNotes("");
      await loadTakes();
      setSelectedId(created.id);
    } catch (e) {
      toast({
        title: t("error"),
        description: getErrorMessage(e),
        variant: "destructive",
      });
    }
  };

  const saveLine = async (lineId: string, counted: string) => {
    if (!selectedId || !/^\d+$/.test(counted)) return;
    try {
      const res = await authFetch(`/api/stock-takes/${selectedId}/lines/${lineId}`, {
        method: "PATCH",
        body: JSON.stringify({ countedStock: counted }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.message || "Save failed");
      }
      await loadDetail(selectedId);
    } catch (e) {
      toast({
        title: t("error"),
        description: getErrorMessage(e),
        variant: "destructive",
      });
    }
  };

  const cancelTake = async () => {
    if (!selectedId) return;
    try {
      const res = await authFetch(`/api/stock-takes/${selectedId}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.message || "Cancel failed");
      }
      toast({ title: t("stockTakeCancelled") });
      setSelectedId(null);
      await loadTakes();
    } catch (e) {
      toast({
        title: t("error"),
        description: getErrorMessage(e),
        variant: "destructive",
      });
    }
  };

  const finalizeTake = async () => {
    if (!selectedId) return;
    try {
      const res = await authFetch(`/api/stock-takes/${selectedId}/finalize`, {
        method: "POST",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.message || "Finalize failed");
      }
      toast({ title: t("stockTakeFinalized") });
      setFinalizeOpen(false);
      setSelectedId(null);
      await loadTakes();
    } catch (e) {
      toast({
        title: t("error"),
        description: getErrorMessage(e),
        variant: "destructive",
      });
    }
  };

  const statusBadge = (s: TakeSummary["status"]) => {
    switch (s) {
      case "draft":
        return <Badge variant="outline">{t("stockTakeStatusDraft")}</Badge>;
      case "completed":
        return <Badge variant="secondary">{t("stockTakeStatusCompleted")}</Badge>;
      case "cancelled":
        return <Badge variant="destructive">{t("stockTakeStatusCancelled")}</Badge>;
      default:
        return s;
    }
  };

  if (error && !loading) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="p-4 sm:p-6 space-y-6" data-testid="page-stock-take">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
              <Link href="/produktuak">
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t("products")}
              </Link>
            </Button>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardCheck className="h-7 w-7" />
              {t("stockTake")}
            </h2>
            <p className="text-muted-foreground">{t("stockTakeDescription")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {draftTake && !selectedId ? (
              <Button
                variant="secondary"
                data-testid="button-resume-stock-take-header"
                onClick={() => setSelectedId(draftTake.id)}
              >
                {t("resumeStockTake")}
              </Button>
            ) : null}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-stock-take" disabled={!!draftTake}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("newStockTake")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("newStockTake")}</DialogTitle>
                  <DialogDescription>{t("newStockTakeDescription")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t("notes")}</Label>
                    <Input value={createNotes} onChange={e => setCreateNotes(e.target.value)} />
                  </div>
                  <p className="text-sm text-muted-foreground">{t("newStockTakeAllProducts")}</p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>
                      {t("cancel")}
                    </Button>
                    <Button data-testid="button-confirm-new-stock-take" onClick={() => void startTake()}>
                      {t("confirm")}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {draftTake && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-4 text-sm">
              {t("stockTakeDraftBanner")}{" "}
              <Button
                variant="link"
                className="p-0 h-auto"
                data-testid="link-resume-stock-take"
                onClick={() => setSelectedId(draftTake.id)}
              >
                {t("resumeStockTake")}
              </Button>
            </CardContent>
          </Card>
        )}

        {selectedId ? (
          !takeDetail && loadingDetail ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {t("loading")}…
              </CardContent>
            </Card>
          ) : takeDetail ? (
            <Card>
              <CardContent className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    {statusBadge(takeDetail.take.status)}
                    <span className="text-sm text-muted-foreground">
                      {new Date(takeDetail.take.date).toLocaleString()}
                    </span>
                  </div>
                  {takeDetail.take.notes ? (
                    <p className="text-sm mt-1">{takeDetail.take.notes}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setSelectedId(null)}>
                    {t("backToList")}
                  </Button>
                  {takeDetail.take.status === "draft" ? (
                    <>
                      <Button
                        variant="destructive"
                        data-testid="button-cancel-stock-take"
                        onClick={() => void cancelTake()}
                      >
                        {t("cancelStockTake")}
                      </Button>
                      <Button onClick={() => setFinalizeOpen(true)}>{t("finalize")}</Button>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("product")}</TableHead>
                        <TableHead className="text-right">{t("systemStock")}</TableHead>
                        <TableHead className="text-right">{t("countedStock")}</TableHead>
                        <TableHead className="text-right">{t("variance")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {takeDetail.lines.map(line => {
                        const v = line.variance != null ? parseInt(line.variance, 10) : null;
                        return (
                          <TableRow key={line.id}>
                            <TableCell className="font-medium">
                              {line.productName}{" "}
                              <span className="text-muted-foreground text-xs">
                                ({line.productUnit})
                              </span>
                            </TableCell>
                            <TableCell className="text-right">{line.systemStock}</TableCell>
                            <TableCell className="text-right">
                              {takeDetail.take.status === "draft" ? (
                                <Input
                                  className="w-24 ml-auto text-right"
                                  defaultValue={line.countedStock ?? ""}
                                  placeholder="0"
                                  data-testid={`input-counted-${line.id}`}
                                  onBlur={e => {
                                    const v = e.target.value.trim();
                                    if (v && v !== (line.countedStock ?? "")) {
                                      void saveLine(line.id, v);
                                    }
                                  }}
                                />
                              ) : (
                                line.countedStock ?? "—"
                              )}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right font-mono",
                                v === 0 && "text-muted-foreground",
                                v != null && v > 0 && "text-green-600 dark:text-green-400",
                                v != null && v < 0 && "text-destructive"
                              )}
                            >
                              {line.variance != null ? line.variance : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
            </CardContent>
          </Card>
          ) : null
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("notes")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      {t("loading")}…
                    </TableCell>
                  </TableRow>
                ) : takes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      {t("noStockTakes")}
                    </TableCell>
                  </TableRow>
                ) : (
                  takes.map(tk => (
                    <TableRow key={tk.id}>
                      <TableCell>{new Date(tk.date).toLocaleString()}</TableCell>
                      <TableCell>{statusBadge(tk.status)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{tk.notes ?? "—"}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => setSelectedId(tk.id)}>
                          {t("openDetail")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        )}

        <AlertDialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("finalizeStockTakeTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("finalizeStockTakeDescription")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={() => void finalizeTake()}>
                {t("finalize")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ErrorBoundary>
  );
}
