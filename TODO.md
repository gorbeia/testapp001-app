allow creation of reservations for today
when cancelling a reservation make mandatory an explanation
signature for SEPA authorization
Notification on debt calculation
Notification on debt validation
email notifications
devolutions
don't allow deletion of product categories if they are in use

unify permissions denied messages ✓ COMPLETED
    - Created unified AccessDenied component
    - Updated ProtectedRoute to use AccessDenied
    - Updated CreditsPage to use ProtectedRoute instead of custom access control
    - Updated NotesManagementPage to use AccessDenied
    - All admin pages now show consistent access denied message

Use specific folder for pages different from componentes ✓ COMPLETED
    - Moved all Page components from /components to /pages
    - Moved dashboard folder to /pages/dashboard
    - Moved announcements folder to /pages/announcements
    - Updated all import statements in App.tsx
    - Updated cross-references in NotesManagementPage
    - Components folder now contains only shared UI components


Mutliple society management