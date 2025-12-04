import { LanguageProvider } from '../LanguageProvider';
import { ThemeProvider } from '../ThemeProvider';
import { UsersPage } from '../UsersPage';
import { Toaster } from '@/components/ui/toaster';

export default function UsersPageExample() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <UsersPage />
        <Toaster />
      </LanguageProvider>
    </ThemeProvider>
  );
}
