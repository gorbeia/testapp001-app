import { NotesManagementPage } from '@/pages/NotesManagementPage';

export default function OharrakPage() {
  // ProtectedRoute handles access control, so we can directly return the admin page
  return <NotesManagementPage />;
}
