import { LanguageProvider } from '../LanguageProvider';
import { ThemeProvider } from '../ThemeProvider';
import { ProductsPage } from '../ProductsPage';
import { Toaster } from '@/components/ui/toaster';

export default function ProductsPageExample() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ProductsPage />
        <Toaster />
      </LanguageProvider>
    </ThemeProvider>
  );
}
