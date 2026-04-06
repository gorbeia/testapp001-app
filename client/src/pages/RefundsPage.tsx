import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/lib/i18n";
import { authFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type UserRow = { id: string; name: string | null; username: string };

export function RefundsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [userId, setUserId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [description, setDescription] = React.useState("");

  const usersQuery = useQuery({
    queryKey: ["users-refunds"],
    queryFn: async () => {
      const res = await authFetch("/api/users");
      if (!res.ok) throw new Error("users");
      return res.json() as Promise<UserRow[]>;
    },
  });

  const refundMut = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/account-movements/refund", {
        method: "POST",
        body: JSON.stringify({
          userId,
          amount: parseFloat(amount),
          description,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-movements-me"] });
      qc.invalidateQueries({ queryKey: ["account-movements-admin"] });
      setAmount("");
      setDescription("");
      toast({ title: t("success") });
    },
    onError: () => {
      toast({ title: t("error"), variant: "destructive" });
    },
  });

  return (
    <div className="p-4 sm:p-6 space-y-4" data-testid="refunds-page">
      <h1 className="text-2xl font-bold" data-testid="refunds-title">
        {t("refundsMenu")}
      </h1>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>{t("issueRefund")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t("filterByMember")}</Label>
            <Select value={userId} onValueChange={setUserId}>
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
              value={amount}
              onChange={e => setAmount(e.target.value)}
              data-testid="input-refund-amount"
            />
          </div>
          <div>
            <Label>{t("refundDescription")}</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              data-testid="input-refund-description"
            />
          </div>
          <Button
            onClick={() => refundMut.mutate()}
            disabled={!userId || !amount || !description.trim()}
            data-testid="button-submit-refund"
          >
            {t("issueRefund")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
