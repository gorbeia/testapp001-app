import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth, hasAdminAccess } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { Plus } from 'lucide-react';
import { Oharrak } from './types';
import { NoteCard } from './NoteCard';
import { NoteForm } from './NoteForm';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';
import { OharrakAPI } from './api';

export default function OharrakPage() {
  const { t } = useLanguage();
  const [notes, setNotes] = useState<Oharrak[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Oharrak | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    isActive: true
  });
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const data = await OharrakAPI.fetchNotes();
      setNotes(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las notas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: 'Error',
        description: 'El título y el contenido son obligatorios',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingNote) {
        await OharrakAPI.updateNote(editingNote.id, formData);
        toast({
          title: 'Éxito',
          description: 'Nota actualizada',
        });
      } else {
        await OharrakAPI.createNote(formData);
        toast({
          title: 'Éxito',
          description: 'Nota creada',
        });
      }
      
      setIsCreateDialogOpen(false);
      setIsEditDialogOpen(false);
      setEditingNote(null);
      setFormData({ title: '', content: '', isActive: true });
      fetchNotes();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la nota',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (note: Oharrak) => {
    setEditingNote(note);
    setFormData({
      title: note.title,
      content: note.content,
      isActive: note.isActive
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (noteId: string) => {
    try {
      await OharrakAPI.deleteNote(noteId);
      toast({
        title: 'Éxito',
        description: 'Nota eliminada',
      });
      fetchNotes();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la nota',
        variant: 'destructive',
      });
    }
  };

  const toggleActive = async (note: Oharrak) => {
    try {
      await OharrakAPI.toggleNoteStatus(note);
      toast({
        title: 'Éxito',
        description: `Nota ${!note.isActive ? 'activada' : 'desactivada'}`,
      });
      fetchNotes();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la nota',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  const isAdmin = hasAdminAccess(user);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('announcements')}</h1>
        {isAdmin && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                {t('newNote')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t('createNewNote')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">{t('title')}</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={t('noteTitlePlaceholder')}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="content">{t('content')}</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder={t('noteContentPlaceholder')}
                    rows={4}
                    required
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    {t('cancel')}
                  </Button>
                  <Button type="submit">
                    {t('save')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4">
        {notes.length === 0 ? (
          <EmptyState isAdmin={isAdmin} />
        ) : (
          notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isAdmin={isAdmin}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleActive={toggleActive}
            />
          ))
        )}
      </div>

      <NoteForm
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
        isEditing={true}
      />
    </div>
  );
}
