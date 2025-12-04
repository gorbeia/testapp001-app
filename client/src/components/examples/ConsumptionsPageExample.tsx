import { LanguageProvider } from '../LanguageProvider';
import { ThemeProvider } from '../ThemeProvider';
import { ConsumptionsPage } from '../ConsumptionsPage';
import { Toaster } from '@/components/ui/toaster';

export default function ConsumptionsPageExample() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ConsumptionsPage />
        <Toaster />
      </LanguageProvider>
    </ThemeProvider>
  );
}
