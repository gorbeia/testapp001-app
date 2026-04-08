import * as React from "react";
import PaginationControls from "@/components/PaginationControls";
import { usePagination } from "@/hooks/use-pagination";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { authFetch } from "@/lib/api";
import { readJsonOrThrow } from "@/lib/http-error";
import { AccessDeniedOrError } from "@/components/AccessDeniedOrError";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "wouter";
import { societyAllowsBankTransferPrepayment } from "@shared/schema";

type UserRow = { id: string; name: string | null; username: string };

type BankTransferRow = {
  id: string;
  userId: string;
  amount: string;
  transferDate: string;
  reference: string | null;
  notes: string | null;
  status: string;
  memberName: string | null;
};

const BANK_TRANSFER_STATUS_I18N: Record<string, TranslationKey> = {
  pending: "bankTransferStatusPending",
  validated: "bankTransferStatusValidated",
  rejected: "bankTransferStatusRejected",
};

export function BankTransfersPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [refundOpen, setRefundOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [form, setForm] = React.useState({
    userId: "",
    amount: "",
    transferDate: "",
    reference: "",
    notes: "",
  });
  const [refundForm, setRefundForm] = React.useState({
    userId: "",
    amount: "",
    description: "",
  });

  const societyQuery = useQuery({
    queryKey: ["societies", "user"],
    queryFn: async () => {
      const res = await authFetch("/api/societies/user");
      return readJsonOrThrow<{ paymentMethods?: unknown }>(res);
    },
  });

  const prepaymentEnabled = societyAllowsBankTransferPrepayment(societyQuery.data?.paymentMethods);

  const usersQuery = useQuery({
    queryKey: ["users-bank-transfers"],
    enabled: societyQuery.isSuccess && prepaymentEnabled,
    queryFn: async () => {
      const res = await authFetch("/api/users");
      return readJsonOrThrow<UserRow[]>(res);
    },
  });

  const pagination = usePagination({ initialPage: 1, initialLimit: 25 });

  const listQuery = useQuery({
    queryKey: ["bank-transfers", pagination.page, pagination.limit],
    enabled: societyQuery.isSuccess && prepaymentEnabled,
    queryFn: async () => {
      const params = new URLSearchParams({
        status: "pending",
        page: String(pagination.page),
        limit: String(pagination.limit),
      });
      const res = await authFetch(`/api/bank-transfers?${params.toString()}`);
      return readJsonOrThrow<{ data: BankTransferRow[]; total: number }>(res);
    },
  });

  React.useEffect(() => {
    if (listQuery.data && typeof listQuery.data.total === "number") {
      pagination.updatePagination(listQuery.data.total);
    }
  }, [listQuery.data?.total]);

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/bank-transfers", {
        method: "POST",
        body: JSON.stringify({
          userId: form.userId,
          amount: parseFloat(form.amount),
          transferDate: form.transferDate || new Date().toISOString().slice(0, 10),
          reference: form.reference || undefined,
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-transfers"] });
      setOpen(false);
      setForm({ userId: "", amount: "", transferDate: "", reference: "", notes: "" });
      toast({ title: t("success"), description: t("createTransfer") });
    },
    onError: () => {
      toast({ title: t("error"), variant: "destructive" });
    },
  });

  const validateMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/bank-transfers/${id}/validate`, { method: "PUT" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-transfers"] });
      qc.invalidateQueries({ queryKey: ["account-movements-me"] });
      qc.invalidateQueries({ queryKey: ["account-movements-admin"] });
      toast({ title: t("success") });
    },
  });

  const refundMut = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/account-movements/refund", {
        method: "POST",
        body: JSON.stringify({
          userId: refundForm.userId,
          amount: parseFloat(refundForm.amount),
          description: refundForm.description,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-movements-me"] });
      qc.invalidateQueries({ queryKey: ["account-movements-admin"] });
      setRefundOpen(false);
      setRefundForm({ userId: "", amount: "", description: "" });
      toast({ title: t("success") });
    },
    onError: () => {
      toast({ title: t("error"), variant: "destructive" });
    },
  });

  const rejectMut = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await authFetch(`/api/bank-transfers/${id}/reject`, {
        method: "PUT",
        body: JSON.stringify({ rejectionReason: reason }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-transfers"] });
      setRejectOpen(null);
      setRejectReason("");
      toast({ title: t("success") });
    },
  });

  const pendingRows = listQuery.data?.data ?? [];

  if (societyQuery.isLoading) {
    return <div className="p-4 sm:p-6">{t("loading")}</div>;
  }

  if (societyQuery.isError && societyQuery.error) {
    return (
      <div className="p-4 sm:p-6" data-testid="bank-transfers-society-error">
        <AccessDeniedOrError error={societyQuery.error} onRetry={() => societyQuery.refetch()} />
      </div>
    );
  }

  if (societyQuery.isSuccess && !prepaymentEnabled) {
    return (
      <div
        className="p-4 sm:p-6 space-y-4 sm:space-y-6"
        data-testid="bank-transfers-prepayment-disabled"
      >
        <div>
          <h2 className="text-2xl font-bold">{t("bankTransfersMenu")}</h2>
          <p className="text-muted-foreground">{t("bankTransfersPrepaymentDisabledDescription")}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t("bankTransfersPrepaymentDisabledTitle")}</CardTitle>
            <CardDescription>{t("bankTransfersPrepaymentDisabledDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link href="/elkartea">{t("bankTransfersPrepaymentDisabledGoToSociety")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4" data-testid="bank-transfers-page">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h1 className="text-2xl font-bold" data-testid="bank-transfers-title">
          {t("bankTransfersMenu")}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-issue-refund">
                {t("issueRefund")}
              </Button>
            </DialogTrigger>
            <DialogContent
              data-testid="dialog-issue-refund"
              onCloseAutoFocus={e => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>{t("issueRefund")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>{t("filterByMember")}</Label>
                  <Select
                    value={refundForm.userId}
                    onValueChange={v => setRefundForm(f => ({ ...f, userId: v }))}
                  >
                    <SelectTrigger data-testid="select-refund-user">
                      <SelectValue placeholder={t("selectPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(usersQuery.data ?? []).map(u => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name || u.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("refundAmount")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={refundForm.amount}
                    onChange={e => setRefundForm(f => ({ ...f, amount: e.target.value }))}
                    data-testid="input-refund-amount"
                  />
                </div>
                <div>
                  <Label>{t("refundDescription")}</Label>
                  <Textarea
                    value={refundForm.description}
                    onChange={e => setRefundForm(f => ({ ...f, description: e.target.value }))}
                    data-testid="input-refund-description"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => refundMut.mutate()}
                  disabled={
                    !refundForm.userId || !refundForm.amount || !refundForm.description.trim()
                  }
                  data-testid="button-submit-refund"
                >
                  {t("issueRefund")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-transfer">{t("createTransfer")}</Button>
            </DialogTrigger>
            <DialogContent
              data-testid="dialog-new-transfer"
              onCloseAutoFocus={e => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>{t("createTransfer")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>{t("filterByMember")}</Label>
                  <Select
                    value={form.userId}
                    onValueChange={v => setForm(f => ({ ...f, userId: v }))}
                  >
                    <SelectTrigger data-testid="select-transfer-user">
                      <SelectValue placeholder={t("selectPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(usersQuery.data ?? []).map(u => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name || u.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("refundAmount")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    data-testid="input-transfer-amount"
                  />
                </div>
                <div>
                  <Label>{t("transferDate")}</Label>
                  <Input
                    type="date"
                    value={form.transferDate}
                    onChange={e => setForm(f => ({ ...f, transferDate: e.target.value }))}
                    data-testid="input-transfer-date"
                  />
                </div>
                <div>
                  <Label>{t("transferReference")}</Label>
                  <Input
                    value={form.reference}
                    onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                    data-testid="input-transfer-reference"
                  />
                </div>
                <div>
                  <Label>{t("notesPlaceholder")}</Label>
                  <Textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    data-testid="input-transfer-notes"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createMut.mutate()}
                  disabled={!form.userId || !form.amount}
                  data-testid="button-save-transfer"
                >
                  {t("create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle data-testid="transfer-list-title">{t("transferList")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("member")}</TableHead>
                <TableHead>{t("amount")}</TableHead>
                <TableHead>{t("transferDate")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {listQuery.isLoading ? "…" : "—"}
                  </TableCell>
                </TableRow>
              ) : (
                pendingRows.map(tr => (
                  <TableRow key={tr.id} data-testid={`transfer-row-${tr.id}`}>
                    <TableCell data-testid={`transfer-member-${tr.id}`}>
                      {tr.memberName ?? tr.userId}
                    </TableCell>
                    <TableCell data-testid={`transfer-amount-${tr.id}`}>
                      {parseFloat(tr.amount).toFixed(2)}€
                    </TableCell>
                    <TableCell>{tr.transferDate}</TableCell>
                    <TableCell data-testid={`transfer-status-${tr.id}`}>
                      {BANK_TRANSFER_STATUS_I18N[tr.status]
                        ? t(BANK_TRANSFER_STATUS_I18N[tr.status])
                        : tr.status}
                    </TableCell>
                    <TableCell className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => validateMut.mutate(tr.id)}
                        data-testid={`button-validate-${tr.id}`}
                      >
                        {t("validateTransfer")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRejectOpen(tr.id)}
                        data-testid={`button-reject-open-${tr.id}`}
                      >
                        {t("rejectTransfer")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <PaginationControls pagination={pagination} itemType="transfersForPagination" />
        </CardContent>
      </Card>

      <Dialog open={!!rejectOpen} onOpenChange={() => setRejectOpen(null)}>
        <DialogContent
          data-testid="dialog-reject-transfer"
          onCloseAutoFocus={e => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{t("rejectTransfer")}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            data-testid="input-reject-reason"
          />
          <DialogFooter>
            <Button
              onClick={() =>
                rejectOpen &&
                rejectReason.trim() &&
                rejectMut.mutate({ id: rejectOpen, reason: rejectReason })
              }
              data-testid="button-confirm-reject"
            >
              {t("rejectTransfer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
