import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Circle, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import type { SetupChecklistItemId } from "@shared/society-setup-checklist";
import { setupChecklistResponseSchema } from "@shared/society-setup-checklist";

const DISMISS_STORAGE_PREFIX = "society-setup-guide-dismissed:";

const HREF_BY_ITEM: Record<SetupChecklistItemId, string> = {
  contact: "/elkartea",
  sepa: "/elkartea",
  category: "/kategoriak",
  product: "/produktuak",
  table: "/mahaiak",
  members: "/erabiltzaileak",
  subdomain: "/elkartea",
};

function titleKey(id: SetupChecklistItemId): TranslationKey {
  return `setupGuideItem_${id}_title` as TranslationKey;
}

function descKey(id: SetupChecklistItemId): TranslationKey {
  return `setupGuideItem_${id}_desc` as TranslationKey;
}

export function SocietySetupGuide() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [open, setOpen] = useState(true);

  const societyId = user?.societyId ?? "";
  const dismissedKey = societyId ? `${DISMISS_STORAGE_PREFIX}${societyId}` : null;
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined" || !dismissedKey) return false;
    return window.localStorage.getItem(dismissedKey) === "1";
  });

  const { data, isError, isPending } = useQuery({
    queryKey: ["/api/societies/setup-checklist"],
    queryFn: async () => {
      const res = await fetch("/api/societies/setup-checklist", { credentials: "include" });
      if (!res.ok) {
        throw new Error(`setup-checklist ${res.status}`);
      }
      const json: unknown = await res.json();
      return setupChecklistResponseSchema.parse(json);
    },
    enabled: user?.accessRole === "admin" && !!societyId,
  });

  const visibleItems = useMemo(() => {
    if (!data?.items?.length) return [];
    return data.items.filter(item => !(item.id === "subdomain" && item.applicable === false));
  }, [data?.items]);

  const doneCount = useMemo(() => visibleItems.filter(i => i.done).length, [visibleItems]);
  const total = visibleItems.length;
  const allDone = total > 0 && doneCount === total;

  if (user?.accessRole !== "admin" || !societyId) {
    return null;
  }

  if (dismissed && allDone) {
    return null;
  }

  if (isError) {
    return null;
  }

  if (isPending || !data) {
    return (
      <div
        className="border-b bg-muted/40 shrink-0 px-3 py-2 sm:px-4"
        data-testid="society-setup-guide"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ListChecks className="h-4 w-4 shrink-0 animate-pulse" aria-hidden />
          <span className="truncate">{t("setupGuideTitle")}</span>
        </div>
      </div>
    );
  }

  const handleDismiss = () => {
    if (!dismissedKey || !allDone) return;
    window.localStorage.setItem(dismissedKey, "1");
    setDismissed(true);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border-b bg-muted/40 shrink-0" data-testid="society-setup-guide">
        <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
          <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex flex-1 min-w-0 items-center gap-2 text-left text-sm font-medium hover:opacity-90"
              aria-expanded={open}
            >
              <span className="truncate">{t("setupGuideTitle")}</span>
              <span className="text-muted-foreground font-normal tabular-nums shrink-0">
                {t("setupGuideProgress", { done: doneCount, total })}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  open && "rotate-180"
                )}
                aria-hidden
              />
            </button>
          </CollapsibleTrigger>
          {allDone && (
            <Button variant="ghost" size="sm" className="shrink-0 h-8" onClick={handleDismiss}>
              {t("setupGuideHide")}
            </Button>
          )}
        </div>
        <CollapsibleContent>
          <div className="px-3 pb-3 sm:px-4 space-y-2 border-t border-border/60 pt-2">
            <p className="text-xs text-muted-foreground">{t("setupGuideSubtitle")}</p>
            <ul className="space-y-1.5">
              {visibleItems.map(item => (
                <li key={item.id}>
                  <Link
                    href={HREF_BY_ITEM[item.id]}
                    className={cn(
                      "flex gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/80",
                      item.done && "opacity-70"
                    )}
                  >
                    {item.done ? (
                      <Check className="h-4 w-4 shrink-0 text-green-600 mt-0.5" aria-hidden />
                    ) : (
                      <Circle
                        className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5"
                        aria-hidden
                      />
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="font-medium block">{t(titleKey(item.id))}</span>
                      <span className="text-muted-foreground text-xs block">
                        {t(descKey(item.id))}
                      </span>
                      <span className="sr-only">
                        {item.done ? t("setupGuideStatusDone") : t("setupGuideStatusTodo")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {allDone && (
              <p className="text-xs text-muted-foreground pt-1">{t("setupGuideAllDone")}</p>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
