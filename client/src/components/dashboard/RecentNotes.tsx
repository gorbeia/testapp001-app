import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FileText, AlertCircle, Megaphone } from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
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

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-3 rounded-md bg-muted/50 animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </div>
        ))}
      </div>
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
        <TooltipProvider>
          {notes.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t('noActiveNotes')}</div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 rounded-md bg-muted/50"
                  data-testid={`note-item-${note.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="font-medium text-sm cursor-help hover:text-primary transition-colors">
                            {note.title}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs text-sm">{note.content}</p>
                        </TooltipContent>
                      </Tooltip>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(note.createdAt), 'PPP', { locale: es })}
                      </p>
                    </div>
                  </div>
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
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
