import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUrlFilter } from "@/hooks/useUrlFilter";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { authFetch } from "@/lib/api";
import MonthGrid from "@/components/MonthGrid";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { movementTypeLabelKey } from "@/lib/movement-type-label";
import { List, Scale, Wallet, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const MOVEMENT_TYPES = [
  "all",
  "consumption",
  "reservation",
  "subscription",
  "sepa_collection",
  "sepa_bounce",
  "bank_transfer",
  "refund",
  "adjustment",
] as const;

type BankTransferMeRow = {
  id: string;
  amount: string;
  transferDate: string;
  reference: string | null;
  notes: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
};

function balanceAmountClass(b: number) {
  if (b < 0) return "text-destructive";
  if (b > 0) return "text-green-600";
  return "text-muted-foreground";
}

const BANK_TRANSFER_STATUS_I18N: Record<string, TranslationKey> = {
  pending: "bankTransferStatusPending",
  validated: "bankTransferStatusValidated",
  rejected: "bankTransferStatusRejected",
};

export function MyMovementsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [proposalOpen, setProposalOpen] = useState(false);

  const proposalFormSchema = useMemo(
    () =>
      z.object({
        amount: z
          .string()
          .min(1, { message: t("transferProposalAmountInvalid") })
          .refine(
            val => {
              const n = parseFloat(val.replace(",", "."));
              return !Number.isNaN(n) && n > 0;
            },
            { message: t("transferProposalAmountInvalid") }
          ),
        transferDate: z.string().min(1, { message: t("selectDate") }),
        reference: z.string().optional(),
        notes: z.string().optional(),
      }),
    [t]
  );

  type ProposalFormValues = z.infer<typeof proposalFormSchema>;

  const proposalForm = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues: {
      amount: "",
      transferDate: new Date().toISOString().slice(0, 10),
      reference: "",
      notes: "",
    },
  });

  const monthFilter = useUrlFilter({
    baseUrl: "/nire-mugimenduak",
    paramName: "month",
    initialValue: "",
  });
  const [type, setType] = useState<string>("all");
  const month = monthFilter.value;

  const query = useQuery({
    queryKey: ["account-movements-me", month, type],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (month) params.set("month", month);
      if (type !== "all") params.set("type", type);
      const res = await authFetch(`/api/account-movements/me?${params}`);
      if (!res.ok) throw new Error("Failed to load movements");
      return res.json() as Promise<{
        balance: number;
        movements: Array<{
          id: string;
          type: string;
          amount: string;
          description: string | null;
          createdAt: string;
          runningBalance: number;
        }>;
      }>;
    },
  });

  const transfersQuery = useQuery({
    queryKey: ["bank-transfers-me", "pending"],
    queryFn: async () => {
      const res = await authFetch("/api/bank-transfers/me?status=pending");
      if (!res.ok) throw new Error("bank-transfers-me");
      return res.json() as Promise<BankTransferMeRow[]>;
    },
  });

  const pendingTransferRows = transfersQuery.data ?? [];
  const showPendingTransfersTable =
    !transfersQuery.isLoading && pendingTransferRows.length > 0;

  const proposalMut = useMutation({
    mutationFn: async (values: ProposalFormValues) => {
      const amount = parseFloat(values.amount.replace(",", "."));
      const res = await authFetch("/api/bank-transfers/me", {
        method: "POST",
        body: JSON.stringify({
          amount,
          transferDate: values.transferDate,
          reference: values.reference?.trim() || undefined,
          notes: values.notes?.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "proposal");
      }
      return res.json() as Promise<BankTransferMeRow>;
    },
  });

  const onProposalSubmit = async (values: ProposalFormValues) => {
    try {
      await proposalMut.mutateAsync(values);
    } catch {
      toast({
        title: t("error"),
        description: t("transferProposalCreateFailed"),
        variant: "destructive",
      });
      return;
    }
    proposalForm.reset({
      amount: "",
      transferDate: new Date().toISOString().slice(0, 10),
      reference: "",
      notes: "",
    });
    toast({ title: t("success"), description: t("transferProposalCreated") });
    setProposalOpen(false);
    void qc.invalidateQueries({ queryKey: ["bank-transfers-me"] });
  };

  const periodStats = useMemo(() => {
    const movements = query.data?.movements ?? [];
    const count = movements.length;
    const net = movements.reduce((s, m) => s + parseFloat(m.amount), 0);
    return { count, net };
  }, [query.data?.movements]);

  const balance = query.data?.balance;
  const balanceStatusKey =
    balance === undefined
      ? null
      : balance < 0
        ? "balanceStatusOwed"
        : balance > 0
          ? "balanceStatusCredit"
          : "balanceStatusZero";

  return (
    <div className="p-4 sm:p-6 space-y-4" data-testid="my-movements-page">
      <h1 className="text-2xl font-bold" data-testid="my-movements-title">
        {t("myMovements")}
      </h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-my-movements-balance">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium" data-testid="my-balance-label">
              {t("currentBalance")}
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                balance !== undefined ? balanceAmountClass(balance) : ""
              }`}
              data-testid="my-balance-value"
            >
              {query.isLoading ? "…" : `${(balance ?? 0).toFixed(2)}€`}
            </div>
            {balanceStatusKey && (
              <p className="text-xs text-muted-foreground mt-2">{t(balanceStatusKey)}</p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-my-movements-count">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t("movementsStatsInPeriod")}</CardTitle>
            <List className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="my-movements-period-count">
              {query.isLoading ? "…" : periodStats.count}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-my-movements-net">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">{t("movementsStatsNetInPeriod")}</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                query.isLoading ? "" : balanceAmountClass(periodStats.net)
              }`}
              data-testid="my-movements-period-net"
            >
              {query.isLoading ? "…" : `${periodStats.net.toFixed(2)}€`}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="my-transfer-proposals-section">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark className="h-4 w-4" />
              {t("transferProposalsSection")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{t("transferProposalPendingHelp")}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="button-propose-transfer"
            onClick={() => {
              proposalForm.reset({
                amount: "",
                transferDate: new Date().toISOString().slice(0, 10),
                reference: "",
                notes: "",
              });
              setProposalOpen(true);
            }}
          >
            {t("proposeTransfer")}
          </Button>
          {proposalOpen ? (
            <Dialog
              open
              onOpenChange={next => {
                if (!next) setProposalOpen(false);
              }}
            >
              <DialogContent data-testid="dialog-propose-transfer">
                <DialogHeader>
                  <DialogTitle>{t("proposeTransferDialogTitle")}</DialogTitle>
                </DialogHeader>
                <Form {...proposalForm}>
                  <form
                    onSubmit={proposalForm.handleSubmit(onProposalSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={proposalForm.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("amount")}</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              data-testid="input-transfer-proposal-amount"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={proposalForm.control}
                      name="transferDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("transferDate")}</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              data-testid="input-transfer-proposal-date"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={proposalForm.control}
                      name="reference"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("transferReference")}</FormLabel>
                          <FormControl>
                            <Input data-testid="input-transfer-proposal-reference" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={proposalForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("notes")}</FormLabel>
                          <FormControl>
                            <Textarea data-testid="input-transfer-proposal-notes" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setProposalOpen(false)}
                      >
                        {t("cancel")}
                      </Button>
                      <Button
                        type="submit"
                        disabled={proposalMut.isPending}
                        data-testid="button-submit-transfer-proposal"
                      >
                        {proposalMut.isPending ? t("saving") : t("save")}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          ) : null}
        </CardHeader>
        {showPendingTransfersTable ? (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("transferDate")}</TableHead>
                  <TableHead className="text-right">{t("amount")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("transferReference")}</TableHead>
                  <TableHead>{t("rejectionReason")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingTransferRows.map(row => (
                  <TableRow key={row.id} data-testid={`transfer-proposal-row-${row.id}`}>
                    <TableCell data-testid={`transfer-proposal-created-${row.id}`}>
                      {new Date(row.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell data-testid={`transfer-proposal-date-${row.id}`}>
                      {row.transferDate}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      data-testid={`transfer-proposal-amount-${row.id}`}
                    >
                      {parseFloat(row.amount).toFixed(2)}€
                    </TableCell>
                    <TableCell data-testid={`transfer-proposal-status-${row.id}`}>
                      {BANK_TRANSFER_STATUS_I18N[row.status]
                        ? t(BANK_TRANSFER_STATUS_I18N[row.status])
                        : row.status}
                    </TableCell>
                    <TableCell className="max-w-[8rem] truncate">
                      {row.reference ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[12rem] truncate text-muted-foreground text-sm">
                      {row.rejectionReason ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        ) : null}
      </Card>

      <div className="flex flex-wrap gap-4">
        <div className="w-full sm:w-48" data-testid="filter-month-movements">
          <MonthGrid
            selectedMonth={monthFilter.value}
            onMonthChange={monthFilter.setValue}
            className="w-full sm:w-48"
            mode="past"
            yearRange={{ past: 3, future: 0 }}
          />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-48" data-testid="select-movement-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MOVEMENT_TYPES.map(mt => (
              <SelectItem key={mt} value={mt}>
                {mt === "all" ? t("movementTypesAll") : t(movementTypeLabelKey(mt))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("movementListSection")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3" data-testid="movements-sign-legend">
            {t("movementsSignLegend")}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("movementType")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead className="text-right">{t("runningBalance")}</TableHead>
                <TableHead>{t("title")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(query.data?.movements ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {query.isLoading ? "…" : t("noMovements")}
                  </TableCell>
                </TableRow>
              ) : (
                query.data!.movements.map(m => (
                  <TableRow key={m.id} data-testid={`movement-row-${m.id}`}>
                    <TableCell data-testid={`movement-date-${m.id}`}>
                      {new Date(m.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell data-testid={`movement-type-${m.id}`}>
                      {t(movementTypeLabelKey(m.type))}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      data-testid={`movement-amount-${m.id}`}
                    >
                      {parseFloat(m.amount).toFixed(2)}€
                    </TableCell>
                    <TableCell
                      className="text-right"
                      data-testid={`movement-running-${m.id}`}
                    >
                      {m.runningBalance.toFixed(2)}€
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{m.description ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
