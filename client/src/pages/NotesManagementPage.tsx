import { useState, useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Power, Edit, Trash, Bell, FileText, Plus, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { ErrorFallback } from '@/components/ErrorBoundary';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { authFetch } from '@/lib/api';
import { MultiLanguageNoteForm } from '@/pages/announcements/MultiLanguageNoteForm';
import { NoteWithMessages } from '@/pages/dashboard/api';
import { Language, DisplayContent, getDisplayContent } from '@shared/schema';

// Type alias for clarity
type Note = NoteWithMessages;

// Helper function to fetch full multilanguage notes for admin
const fetchAdminNotes = async (): Promise<Note[]> => {
  const response = await authFetch('/api/notes');
  if (!response.ok) {
    throw new Error('Failed to fetch notes');
  }
  return response.json();
};

export function NotesManagementPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [confirmPushDialog, setConfirmPushDialog] = useState<{ open: boolean; noteId: string; noteTitle: string }>({ open: false, noteId: '', noteTitle: '' });
  const [confirmRevertDialog, setConfirmRevertDialog] = useState<{ open: boolean; noteId: string; noteTitle: string }>({ open: false, noteId: '', noteTitle: '' });

  const [formData, setFormData] = useState({
    messages: [
      { language: 'eu' as const, title: '', content: '' },
      { language: 'es' as const, title: '', content: '' }
    ],
    isActive: true
  });

  // Check if user is admin
  const isAdmin = user?.function === 'administratzailea';

  // Fetch notes from API
  useEffect(() => {
    if (!isAdmin) return;

    const fetchNotes = async () => {
      try {
        setLoading(true);
        const data = await fetchAdminNotes();
        setNotes(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch notes'));
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, [isAdmin]);

  const resetForm = () => {
    setFormData({
      messages: [
        { language: 'eu', title: '', content: '' },
        { language: 'es', title: '', content: '' }
      ],
      isActive: true
    });
    setEditingNote(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (note: Note) => {
    setEditingNote(note);
    setFormData({
      messages: note.messages.map(msg => ({
        language: msg.language as 'eu' | 'es',
        title: msg.title,
        content: msg.content
      })),
      isActive: note.isActive
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that both languages have content
    const hasValidContent = formData.messages.every(msg => 
      msg.title.trim() && msg.content.trim()
    );
    
    if (!hasValidContent) {
      toast({
        title: t('error'),
        description: t('validationRequired'),
        variant: 'destructive',
      });
      return;
    }

    try {
      const url = editingNote ? `/api/notes/${editingNote.id}` : '/api/notes';
      const method = editingNote ? 'PUT' : 'POST';
      
      const response = await authFetch(url, {
        method,
        body: JSON.stringify({
          messages: formData.messages,
          isActive: formData.isActive
        }),
      });

      if (response.ok) {
        const savedNote = await response.json();
        
        if (editingNote) {
          setNotes(prev => prev.map(note => 
            note.id === editingNote.id ? savedNote : note
          ));
          toast({
            title: t('success'),
            description: t('noteUpdated'),
          });
        } else {
          setNotes(prev => [savedNote, ...prev]);
          toast({
            title: t('success'),
            description: t('noteCreated'),
          });
        }
        
        setIsDialogOpen(false);
        resetForm();
      } else {
        throw new Error('Failed to save note');
      }
    } catch (error) {
      console.error('Error saving note:', error);
      toast({
        title: t('error'),
        description: t('noteSaveFailed'),
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm('Ziur zaude ohar hau ezabatu nahi duzula? / ¿Estás seguro de eliminar esta nota?')) {
      return;
    }

    try {
      const response = await authFetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotes(prev => prev.filter(note => note.id !== noteId));
        toast({
          title: t('success'),
          description: t('noteDeleted'),
        });
      } else {
        throw new Error('Failed to delete note');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      toast({
        title: t('error'),
        description: t('noteDeleteFailed'),
        variant: 'destructive',
      });
    }
  };

  const getNoteDisplayContent = (note: Note): DisplayContent => {
    return getDisplayContent(note, language as Language);
  };

  const handlePushNotification = async (noteId: string) => {
    try {
      const response = await authFetch(`/api/notes/${noteId}/notify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notifyUsers: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to push notifications');
      }

      const updatedNote = await response.json();
      
      // Update the note in the local state
      setNotes(prev => prev.map(note => 
        note.id === noteId ? { ...note, notifyUsers: true } : note
      ));

      toast({
        title: t('notificationsSent'),
        description: t('notificationsSentDescription'),
      });
    } catch (error) {
      console.error('Error pushing notification:', error);
      toast({
        title: t('error'),
        description: t('notificationsFailed'),
        variant: 'destructive',
      });
    }
  };

  const handleRevertNotification = async (noteId: string) => {
    try {
      const response = await authFetch(`/api/notes/${noteId}/notify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notifyUsers: false }),
      });

      if (!response.ok) {
        throw new Error('Failed to revert notifications');
      }

      const updatedNote = await response.json();
      
      // Update the note in the local state
      setNotes(prev => prev.map(note => 
        note.id === noteId ? { ...note, notifyUsers: false } : note
      ));

      toast({
        title: t('notificationsRemoved'),
        description: t('notificationsRemovedDescription'),
      });
    } catch (error) {
      console.error('Error reverting notification:', error);
      toast({
        title: t('error'),
        description: t('notificationsRevertFailed'),
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (noteId: string, currentStatus: boolean) => {
    try {
      const note = notes.find(n => n.id === noteId);
      if (!note) return;

      // Handle both multilanguage and single-language note formats
      const noteData = {
        messages: note.messages || [
          { language: 'eu', title: note.title || '', content: note.content || '' },
          { language: 'es', title: note.title || '', content: note.content || '' }
        ],
        isActive: !currentStatus
      };

      const response = await authFetch(`/api/notes/${noteId}`, {
        method: 'PUT',
        body: JSON.stringify(noteData),
      });

      if (response.ok) {
        const updatedNote = await response.json();
        setNotes(prev => prev.map(n => 
          n.id === noteId ? updatedNote : n
        ));
      } else {
        throw new Error('Failed to update note status');
      }
    } catch (error) {
      console.error('Error toggling note status:', error);
      toast({
        title: t('error'),
        description: t('statusUpdateFailed'),
        variant: 'destructive',
      });
    }
  };

  // Access control is now handled by ProtectedRoute

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="text-center py-12">
          <p>{t('loading')}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{t('notes')}</h2>
            <p className="text-muted-foreground">{t('manageSocietyNotes')}</p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            {t('createNote')}
          </Button>
        </div>

        <MultiLanguageNoteForm
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            resetForm();
          }}
          onSubmit={handleSubmit}
          formData={formData}
          setFormData={setFormData}
          isEditing={!!editingNote}
        />

        <div className="space-y-4">
          {notes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t('noNotes')}</p>
              </CardContent>
            </Card>
          ) : (
            notes.map((note) => (
              <Card key={note.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {getNoteDisplayContent(note).title}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-sm text-muted-foreground">
                          {new Date(note.createdAt).toLocaleDateString('eu-ES')}
                        </span>
                        <Badge variant={note.isActive ? "default" : "secondary"}>
                          {note.isActive ? t('active') : t('inactive')}
                        </Badge>
                        {note.notifyUsers && (
                          <Badge variant="default" className="text-xs">
                            <Bell className="h-3 w-3 mr-1" />
                            Jakinarazpenak bidalita
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TooltipProvider>
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(note)}
                                disabled={loading}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t('editNote')}</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleActive(note.id, note.isActive)}
                                disabled={loading}
                              >
                                {note.isActive ? <Power className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{note.isActive ? t('deactivate') : t('activate')}</p>
                            </TooltipContent>
                          </Tooltip>
                          {!note.notifyUsers && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setConfirmPushDialog({ open: true, noteId: note.id, noteTitle: getNoteDisplayContent(note).title })}
                                  disabled={loading}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t('sendNotifications')}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {note.notifyUsers && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setConfirmRevertDialog({ open: true, noteId: note.id, noteTitle: getNoteDisplayContent(note).title })}
                                  disabled={loading}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t('removeNotifications')}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(note.id)}
                                disabled={loading}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t('deleteNote')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm">
                      {getNoteDisplayContent(note).content}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Push Notification Confirmation Dialog */}
      <AlertDialog open={confirmPushDialog.open} onOpenChange={(open) => !open && setConfirmPushDialog({ open: false, noteId: '', noteTitle: '' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sendNotifications')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirmSendNotifications').replace('{title}', confirmPushDialog.noteTitle)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmPushDialog({ open: false, noteId: '', noteTitle: '' })}>
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              handlePushNotification(confirmPushDialog.noteId);
              setConfirmPushDialog({ open: false, noteId: '', noteTitle: '' });
            }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('send')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revert Notification Confirmation Dialog */}
      <AlertDialog open={confirmRevertDialog.open} onOpenChange={(open) => !open && setConfirmRevertDialog({ open: false, noteId: '', noteTitle: '' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('removeNotifications')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirmRemoveNotifications').replace('{title}', confirmRevertDialog.noteTitle)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmRevertDialog({ open: false, noteId: '', noteTitle: '' })}>
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              handleRevertNotification(confirmRevertDialog.noteId);
              setConfirmRevertDialog({ open: false, noteId: '', noteTitle: '' });
            }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ErrorBoundary>
  );
}
