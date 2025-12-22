import { authFetch } from '@/lib/api';

export interface NoteMessage {
  language: 'eu' | 'es';
  title: string;
  content: string;
}

export interface Note {
  id: string;
  isActive: boolean;
  createdBy: string;
  societyId: string;
  createdAt: string;
  updatedAt: string;
  messages: NoteMessage[];
}

export class NotesAPI {
  static async fetchNotes(): Promise<Note[]> {
    try {
      const response = await authFetch('/api/notes');
      if (!response.ok) {
        throw new Error('Failed to fetch notes');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching notes:', error);
      throw error;
    }
  }

  static async createNote(noteData: {
    messages: NoteMessage[];
    isActive: boolean;
  }): Promise<Note> {
    try {
      const response = await authFetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(noteData),
      });

      if (!response.ok) {
        throw new Error('Failed to create note');
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating note:', error);
      throw error;
    }
  }

  static async updateNote(id: string, noteData: {
    messages: NoteMessage[];
    isActive: boolean;
  }): Promise<Note> {
    try {
      const response = await authFetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(noteData),
      });

      if (!response.ok) {
        throw new Error('Failed to update note');
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating note:', error);
      throw error;
    }
  }

  static async deleteNote(id: string): Promise<void> {
    try {
      const response = await authFetch(`/api/notes/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete note');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      throw error;
    }
  }

  static async toggleNoteStatus(note: Note): Promise<Note> {
    try {
      const response = await authFetch(`/api/notes/${note.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: note.messages,
          isActive: !note.isActive
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle note status');
      }

      return await response.json();
    } catch (error) {
      console.error('Error toggling note status:', error);
      throw error;
    }
  }
}
