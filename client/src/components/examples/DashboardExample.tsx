import { LanguageProvider } from '../LanguageProvider';
import { AuthProvider } from '../AuthProvider';
import { ThemeProvider } from '../ThemeProvider';
import { Dashboard } from '../dashboard';

export default function DashboardExample() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <MockAuthWrapper>
            <Dashboard />
          </MockAuthWrapper>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

function MockAuthWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
