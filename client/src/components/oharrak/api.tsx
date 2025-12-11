import { authFetch } from '@/lib/api';
import { Oharrak } from './types';

export class OharrakAPI {
  static async fetchNotes(): Promise<Oharrak[]> {
    try {
      const response = await authFetch('/api/oharrak');
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
    title: string;
    content: string;
    isActive: boolean;
  }): Promise<Oharrak> {
    try {
      const response = await authFetch('/api/oharrak', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(noteData),
      });

      if (!response.ok) {
        throw new Error('Failed to create note');
      }

      const [newNote] = await response.json();
      return newNote;
    } catch (error) {
      console.error('Error creating note:', error);
      throw error;
    }
  }

  static async updateNote(id: string, noteData: {
    title: string;
    content: string;
    isActive: boolean;
  }): Promise<Oharrak> {
    try {
      const response = await authFetch(`/api/oharrak/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(noteData),
      });

      if (!response.ok) {
        throw new Error('Failed to update note');
      }

      const [updatedNote] = await response.json();
      return updatedNote;
    } catch (error) {
      console.error('Error updating note:', error);
      throw error;
    }
  }

  static async deleteNote(id: string): Promise<void> {
    try {
      const response = await authFetch(`/api/oharrak/${id}`, {
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

  static async toggleNoteStatus(note: Oharrak): Promise<Oharrak> {
    try {
      const response = await authFetch(`/api/oharrak/${note.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...note,
          isActive: !note.isActive
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle note status');
      }

      const [updatedNote] = await response.json();
      return updatedNote;
    } catch (error) {
      console.error('Error toggling note status:', error);
      throw error;
    }
  }
}
