import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n';

interface ErrorDisplayProps {
  error: Error;
  onRetry?: () => void;
  className?: string;
}

export function ErrorDisplay({ error, onRetry, className = "" }: ErrorDisplayProps) {
  const { t } = useLanguage();

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className={`p-4 sm:p-6 ${className}`}>
      <div className="text-center py-12">
        <p className="text-destructive">{t('error')}: {error.message}</p>
        <Button onClick={handleRetry} variant="outline" className="mt-4">
          {t('tryAgain') || 'Try Again'}
        </Button>
      </div>
    </div>
  );
}
