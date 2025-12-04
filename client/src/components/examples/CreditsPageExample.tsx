import { LanguageProvider } from '../LanguageProvider';
import { AuthProvider } from '../AuthProvider';
import { ThemeProvider } from '../ThemeProvider';
import { CreditsPage } from '../CreditsPage';

export default function CreditsPageExample() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <CreditsPage />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
