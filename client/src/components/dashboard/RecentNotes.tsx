import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Megaphone, AlertCircle } from 'lucide-react';
import { Link } from 'wouter';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useLanguage } from '@/lib/i18n';
import { Note } from './api';

interface RecentNotesProps {
  notes: Note[];
  loading: boolean;
  error?: string | null;
}

export function RecentNotes({ notes, loading, error }: RecentNotesProps) {
  const { t } = useLanguage();

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          {t('announcements')}
        </CardTitle>
        <CardDescription>Azken ohar aktiboak</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground">{t('loadingNotes')}</div>
        ) : notes.length === 0 ? (
          <div className="text-sm text-muted-foreground">{t('noActiveNotes')}</div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="p-3 rounded-md bg-muted/50"
                data-testid={`note-item-${note.id}`}
              >
                <p className="font-medium text-sm">{note.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(note.createdAt), 'PPP', { locale: es })}
                </p>
              </div>
            ))}
            {notes.length > 0 && (
              <div className="pt-2">
                <Link href="/oharrak">
                  <Button variant="outline" size="sm" className="w-full">
                    {t('viewAllNotes')}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
