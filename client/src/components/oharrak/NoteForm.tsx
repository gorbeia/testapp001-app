import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ReactNode } from 'react';

interface NoteFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: {
    title: string;
    content: string;
    isActive: boolean;
  };
  setFormData: (data: { title: string; content: string; isActive: boolean }) => void;
  isEditing?: boolean;
  children?: ReactNode;
}

export function NoteForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  formData, 
  setFormData, 
  isEditing = false,
  children
}: NoteFormProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {children && (
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Nota' : 'Crear Nueva Nota'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor={isEditing ? 'edit-title' : 'title'}>Título</Label>
            <Input
              id={isEditing ? 'edit-title' : 'title'}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Título de la nota"
              required
            />
          </div>
          <div>
            <Label htmlFor={isEditing ? 'edit-content' : 'content'}>Contenido</Label>
            <Textarea
              id={isEditing ? 'edit-content' : 'content'}
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Contenido de la nota"
              rows={6}
              required
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={isEditing ? 'edit-isActive' : 'isActive'}
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor={isEditing ? 'edit-isActive' : 'isActive'}>Activa</Label>
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">{isEditing ? 'Actualizar Nota' : 'Crear Nota'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
