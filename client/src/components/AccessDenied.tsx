import { Shield } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

interface AccessDeniedProps {
  className?: string;
}

export function AccessDenied({ className = "" }: AccessDeniedProps) {
  const { t } = useLanguage();

  return (
    <div className={`p-4 sm:p-6 ${className}`}>
      <div className="text-center py-12">
        <Shield className="h-12 w-12 text-muted-foreground mb-4 mx-auto" />
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{t("accessDenied")}</h1>
        <p className="text-gray-600">{t("accessDeniedDescription")}</p>
      </div>
    </div>
  );
}
