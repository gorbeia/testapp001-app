import { LanguageProvider } from '../LanguageProvider';
import { AuthProvider } from '../AuthProvider';
import { ThemeProvider } from '../ThemeProvider';
import { ChatPage } from '../ChatPage';

export default function ChatPageExample() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ChatPage />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
