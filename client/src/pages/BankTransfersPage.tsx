import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/lib/i18n";
import { authFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function BankTransfersPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [form, setForm] = React.useState({
    userId: "",
    amount: "",
    transferDate: "",
    reference: "",
    notes: "",
  });

  const usersQuery = useQuery({
    queryKey: ["users-bank-transfers"],
    queryFn: async () => {
      const res = await authFetch("/api/users");
      if (!res.ok) throw new Error("users");
      return res.json() as Promise<UserRow[]>;
    },
  });

  const listQuery = useQuery({
    queryKey: ["bank-transfers"],
    queryFn: async () => {
      const res = await authFetch("/api/bank-transfers");
      if (!res.ok) throw new Error("list");
      return res.json() as Promise<BankTransferRow[]>;
    },
  });

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

  const pending = (listQuery.data ?? []).filter(x => x.status === "pending");

  return (
    <div className="p-4 sm:p-6 space-y-4" data-testid="bank-transfers-page">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold" data-testid="bank-transfers-title">
          {t("bankTransfersMenu")}
        </h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-transfer">{t("createTransfer")}</Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-new-transfer">
            <DialogHeader>
              <DialogTitle>{t("createTransfer")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t("filterByMember")}</Label>
                <Select value={form.userId} onValueChange={v => setForm(f => ({ ...f, userId: v }))}>
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
              {pending.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {listQuery.isLoading ? "…" : "—"}
                  </TableCell>
                </TableRow>
              ) : (
                pending.map(tr => (
                  <TableRow key={tr.id} data-testid={`transfer-row-${tr.id}`}>
                    <TableCell data-testid={`transfer-member-${tr.id}`}>
                      {tr.memberName ?? tr.userId}
                    </TableCell>
                    <TableCell data-testid={`transfer-amount-${tr.id}`}>
                      {parseFloat(tr.amount).toFixed(2)}€
                    </TableCell>
                    <TableCell>{tr.transferDate}</TableCell>
                    <TableCell>{tr.status}</TableCell>
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
        </CardContent>
      </Card>

      <Dialog open={!!rejectOpen} onOpenChange={() => setRejectOpen(null)}>
        <DialogContent data-testid="dialog-reject-transfer">
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
                rejectOpen && rejectReason.trim() && rejectMut.mutate({ id: rejectOpen, reason: rejectReason })
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
