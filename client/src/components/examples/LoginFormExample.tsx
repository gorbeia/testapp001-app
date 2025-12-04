import { LanguageProvider } from '../LanguageProvider';
import { AuthProvider } from '../AuthProvider';
import { ThemeProvider } from '../ThemeProvider';
import { LoginForm } from '../LoginForm';

export default function LoginFormExample() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
