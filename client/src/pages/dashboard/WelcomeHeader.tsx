import { useLanguage } from "@/lib/i18n";
import { useFormattedDates } from "@/lib/date-locale";
import { useAuth } from "@/lib/auth";

interface WelcomeHeaderProps {
  userName?: string;
}

export function WelcomeHeader({ userName }: WelcomeHeaderProps) {
  const { t } = useLanguage();
  const { formatDateFullWeekday } = useFormattedDates();
  const { user } = useAuth();

  const displayName = userName || user?.name?.split(" ")[0] || "User";

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold">
        {t("welcome")}, {displayName}!
      </h2>
      <p className="text-sm sm:text-base text-muted-foreground">
        {formatDateFullWeekday(new Date())}
      </p>
    </div>
  );
}
