import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";

interface EmptyStateProps {
  isAdmin: boolean;
}

export function EmptyState({ isAdmin }: EmptyStateProps) {
  const { t } = useLanguage();

  return (
    <Card>
      <CardContent className="flex items-center justify-center h-32">
        <div className="text-center">
          <p className="text-muted-foreground">{t("noNotesAvailable")}</p>
          {isAdmin ? (
            <p className="text-sm text-muted-foreground">{t("createFirstNote")}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("adminsCanCreateNotes")}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
