import { LanguageProvider } from '../LanguageProvider';
import { ThemeProvider } from '../ThemeProvider';
import { ReservationsPage } from '../ReservationsPage';
import { Toaster } from '@/components/ui/toaster';

export default function ReservationsPageExample() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ReservationsPage />
        <Toaster />
      </LanguageProvider>
    </ThemeProvider>
  );
}
