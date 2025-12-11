import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth, hasAdminAccess } from '@/lib/auth';
import { Plus } from 'lucide-react';
import { Oharrak } from './types';
import { NoteCard } from './NoteCard';
import { NoteForm } from './NoteForm';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';
import { OharrakAPI } from './api';

export default function OharrakPage() {
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
        <h1 className="text-3xl font-bold">Oharrak (Notas)</h1>
        {isAdmin && (
          <NoteForm
            isOpen={isCreateDialogOpen}
            onClose={() => setIsCreateDialogOpen(false)}
            onSubmit={handleSubmit}
            formData={formData}
            setFormData={setFormData}
            isEditing={false}
          >
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Nota
            </Button>
          </NoteForm>
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
