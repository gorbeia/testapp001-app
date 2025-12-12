import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';

interface WelcomeHeaderProps {
  userName?: string;
}

export function WelcomeHeader({ userName }: WelcomeHeaderProps) {
  const { t } = useLanguage();
  const { user } = useAuth();

  const displayName = userName || user?.name?.split(' ')[0] || 'User';

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold">{t('welcome')}, {displayName}!</h2>
      <p className="text-sm sm:text-base text-muted-foreground">
        {new Date().toLocaleDateString('eu-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
    </div>
  );
}
