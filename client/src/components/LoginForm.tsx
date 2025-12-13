import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, LogIn, AlertCircle, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';

const loginSchema = z.object({
  societyId: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { t } = useLanguage();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      societyId: 'GT001',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);
    try {
      await login(data.email, data.password, data.societyId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      if (errorMessage === 'Server connection failed') {
        setError(t('serverConnectionFailed') || 'Server connection failed. Please try again later.');
      } else if (errorMessage === 'Server error occurred') {
        setError(t('serverErrorOccurred') || 'Server error occurred. Please try again later.');
      } else {
        setError(t('invalidCredentials'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary rounded-full flex items-center justify-center">
            <span className="text-primary-foreground text-2xl font-bold">GT</span>
          </div>
          <CardTitle className="text-2xl font-bold">{t('appName')}</CardTitle>
          <CardDescription>Sociedad Gastronómica</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              
              <FormField
                control={form.control}
                name="societyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('societyId')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          placeholder="GT001"
                          className="pl-10"
                          data-testid="input-society-id"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('email')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="email"
                          placeholder="zure@emaila.eus"
                          className="pl-10"
                          data-testid="input-email"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('password')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="password"
                          placeholder="••••••••"
                          className="pl-10"
                          data-testid="input-password"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
                data-testid="button-login"
              >
                <LogIn className="mr-2 h-4 w-4" />
                {isLoading ? t('loading') : t('login')}
              </Button>
            </form>
          </Form>

          {/* todo: remove mock functionality - demo credentials notice */}
          <div className="mt-6 p-3 bg-muted rounded-md text-xs text-muted-foreground">
            <p className="font-medium mb-1">Demo kontuak / Cuentas demo:</p>
            <ul className="space-y-0.5">
              <li>admin@txokoa.eus (Administratzailea)</li>
              <li>diruzaina@txokoa.eus (Diruzaina)</li>
              <li>sotolaria@txokoa.eus (Sotolaria)</li>
              <li>bazkidea@txokoa.eus (Bazkidea)</li>
              <li>laguna@txokoa.eus (Laguna)</li>
            </ul>
            <p className="mt-1 italic">Pasahitza: edozein / cualquiera</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
