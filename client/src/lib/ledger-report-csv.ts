import { buildCsv } from "@/lib/csv-export";
import { translateMovementType } from "@/lib/movement-type-label";
import { bcp47Locale } from "@/lib/date-locale";
import type { TranslationKey, Language } from "@/lib/i18n";

export type SocietyStatementApi = {
  period: { from: string; to: string };
  societyName: string | null;
  movementCount: number;
  totalDebits: number;
  totalCredits: number;
  periodNet: number;
  generatedAt: string;
  summary: { type: string; total: number }[];
  movements: Array<{
    id: string;
    memberName: string | null;
    memberUsername: string;
    type: string;
    amount: string;
    description: string | null;
    referenceId?: string | null;
    referenceType?: string | null;
    createdAt: string;
  }>;
};

export type AccountStatementApi = {
  period: { from: string; to: string };
  societyName: string | null;
  member: { id: string; name: string | null; username: string };
  openingBalance: number;
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  movementCount: number;
  generatedAt: string;
  summary: { type: string; total: number }[];
  movements: Array<{
    id: string;
    type: string;
    amount: string;
    description: string | null;
    referenceId?: string | null;
    referenceType?: string | null;
    createdAt: string;
    runningBalance: number;
  }>;
};

export type MemberBalancesApi = {
  asOfMonth: string | null;
  members: Array<{ userId: string; name: string | null; username: string; balance: number }>;
  totalBalance: number;
};

function formatStatementDateTime(iso: string, language: Language): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(bcp47Locale(language), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatMovementReference(
  referenceType: string | null | undefined,
  referenceId: string | null | undefined
): string {
  const parts = [referenceType, referenceId].filter(Boolean);
  return parts.join(":") || "";
}

/** Tolerates older API responses before enrichment fields were added. */
function statementTotals(data: AccountStatementApi): {
  totalDebits: number;
  totalCredits: number;
  movementCount: number;
  generatedAtIso: string;
} {
  if (
    typeof data.totalDebits === "number" &&
    typeof data.totalCredits === "number" &&
    typeof data.movementCount === "number" &&
    typeof data.generatedAt === "string"
  ) {
    return {
      totalDebits: data.totalDebits,
      totalCredits: data.totalCredits,
      movementCount: data.movementCount,
      generatedAtIso: data.generatedAt,
    };
  }
  let deb = 0;
  let cred = 0;
  for (const m of data.movements) {
    const a = parseFloat(String(m.amount));
    if (a < 0) deb += -a;
    else if (a > 0) cred += a;
  }
  return {
    totalDebits: Number(deb.toFixed(2)),
    totalCredits: Number(cred.toFixed(2)),
    movementCount: data.movements.length,
    generatedAtIso: new Date().toISOString(),
  };
}

export function buildAccountStatementCsv(
  t: (key: TranslationKey) => string,
  data: AccountStatementApi,
  language: Language = "eu"
): string {
  const { totalDebits, totalCredits, movementCount, generatedAtIso } = statementTotals(data);

  const rows: (string | number)[][] = [
    [t("ledgerStatementSociety"), data.societyName ?? ""],
    [t("ledgerStatementMember"), data.member.name ?? data.member.username],
    [t("ledgerStatementUsername"), data.member.username],
    [t("ledgerStatementGeneratedAt"), formatStatementDateTime(generatedAtIso, language)],
    [t("ledgerStatementPeriod"), `${data.period.from} – ${data.period.to}`],
    [t("ledgerStatementMovementCount"), movementCount],
    [t("ledgerStatementOpeningBalance"), data.openingBalance.toFixed(2)],
    [t("ledgerStatementClosingBalance"), data.closingBalance.toFixed(2)],
    [],
    [t("ledgerStatementSummarySection"), ""],
    [t("movementType"), t("amount")],
  ];
  for (const s of data.summary) {
    rows.push([translateMovementType(t, s.type), s.total.toFixed(2)]);
  }
  rows.push(
    [],
    [t("ledgerStatementTotalDebits"), totalDebits.toFixed(2)],
    [t("ledgerStatementTotalCredits"), totalCredits.toFixed(2)],
    [],
    [t("ledgerStatementMovementsSection"), ""],
    [
      t("date"),
      t("movementType"),
      t("amount"),
      t("runningBalance"),
      t("ledgerStatementReference"),
      t("title"),
    ]
  );
  for (const m of data.movements) {
    rows.push([
      formatStatementDateTime(m.createdAt, language),
      translateMovementType(t, m.type),
      parseFloat(m.amount).toFixed(2),
      m.runningBalance.toFixed(2),
      formatMovementReference(m.referenceType, m.referenceId),
      m.description ?? "",
    ]);
  }
  return buildCsv(rows);
}

export function buildSocietyStatementCsv(
  t: (key: TranslationKey) => string,
  data: SocietyStatementApi,
  language: Language = "eu"
): string {
  const rows: (string | number)[][] = [
    [t("ledgerStatementSociety"), data.societyName ?? ""],
    [t("ledgerStatementGeneratedAt"), formatStatementDateTime(data.generatedAt, language)],
    [t("ledgerStatementPeriod"), `${data.period.from} – ${data.period.to}`],
    [t("ledgerStatementMovementCount"), data.movementCount],
    [t("ledgerStatementTotalDebits"), data.totalDebits.toFixed(2)],
    [t("ledgerStatementTotalCredits"), data.totalCredits.toFixed(2)],
    [t("ledgerSocietyStatementPeriodNet"), data.periodNet.toFixed(2)],
    [],
    [t("ledgerStatementSummarySection"), ""],
    [t("movementType"), t("amount")],
  ];
  for (const s of data.summary) {
    rows.push([translateMovementType(t, s.type), s.total.toFixed(2)]);
  }
  rows.push(
    [],
    [t("ledgerStatementMovementsSection"), ""],
    [
      t("date"),
      t("ledgerStatementMember"),
      t("ledgerStatementUsername"),
      t("movementType"),
      t("amount"),
      t("ledgerStatementReference"),
      t("title"),
    ]
  );
  for (const m of data.movements) {
    rows.push([
      formatStatementDateTime(m.createdAt, language),
      m.memberName ?? "",
      m.memberUsername,
      translateMovementType(t, m.type),
      parseFloat(String(m.amount)).toFixed(2),
      formatMovementReference(m.referenceType, m.referenceId),
      m.description ?? "",
    ]);
  }
  return buildCsv(rows);
}

export function buildMemberBalancesCsv(
  t: (key: TranslationKey) => string,
  data: MemberBalancesApi
): string {
  const periodLabel = data.asOfMonth
    ? `${t("ledgerBalancesAsOfMonth")}: ${data.asOfMonth}`
    : t("ledgerBalancesFullHistory");
  const rows: (string | number)[][] = [
    [periodLabel],
    [],
    [t("name"), t("tableHeaderUser"), t("currentBalance")],
  ];
  for (const m of data.members) {
    rows.push([m.name ?? "", m.username, m.balance.toFixed(2)]);
  }
  rows.push([], [t("ledgerBalancesTotal"), "", data.totalBalance.toFixed(2)]);
  return buildCsv(rows);
}
