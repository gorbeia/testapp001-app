import { LanguageProvider } from '../LanguageProvider';
import { ThemeProvider } from '../ThemeProvider';
import { SepaExportPage } from '../SepaExportPage';
import { Toaster } from '@/components/ui/toaster';

export default function SepaExportPageExample() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <SepaExportPage />
        <Toaster />
      </LanguageProvider>
    </ThemeProvider>
  );
}
