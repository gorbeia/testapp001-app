import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/lib/i18n';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  const { t } = useLanguage();
  
  return (
    <div className="p-4 sm:p-6">
      <Card className="max-w-2xl mx-auto border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('error') || 'Error'}
          </CardTitle>
          <CardDescription>
            {t('error') || 'Something went wrong while loading the data.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {error.message}
          </div>
          <Button onClick={resetErrorBoundary} variant="outline">
            {t('tryAgain') || 'Try Again'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
