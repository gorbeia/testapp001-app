import { LanguageProvider } from '../LanguageProvider';
import { AuthProvider } from '../AuthProvider';
import { ThemeProvider } from '../ThemeProvider';
import { AnnouncementsPage } from '../AnnouncementsPage';
import { Toaster } from '@/components/ui/toaster';

export default function AnnouncementsPageExample() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <AnnouncementsPage />
          <Toaster />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
