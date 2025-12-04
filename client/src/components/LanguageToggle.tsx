import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n';

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-1">
      <Button
        variant={language === 'eu' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setLanguage('eu')}
        data-testid="button-lang-eu"
        className="text-xs px-2"
      >
        EU
      </Button>
      <Button
        variant={language === 'es' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setLanguage('es')}
        data-testid="button-lang-es"
        className="text-xs px-2"
      >
        ES
      </Button>
    </div>
  );
}
