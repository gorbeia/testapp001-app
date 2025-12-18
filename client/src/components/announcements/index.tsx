import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth, hasAdminAccess } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { Plus } from 'lucide-react';
import { NotesAPI, Note, NoteMessage } from './api';
import { NotesManagementPage } from '@/components/NotesManagementPage';

export default function OharrakPage() {
  const { user } = useAuth();
  const isAdmin = hasAdminAccess(user);

  // Use the new multilanguage notes management page for admins
  if (isAdmin) {
    return <NotesManagementPage />;
  }

  // For non-admin users, show a read-only view
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Oharrak</h1>
      </div>
      
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Administratzaileak baino ezin dituzte oharrak ikusi eta kudeatu.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Administratzailearekin harremanetan jarri oharrak ikusteko.
        </p>
      </div>
    </div>
  );
}
