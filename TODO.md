✓ allow creation of reservations for today ✓ COMPLETED

- when cancelling a reservation make mandatory an explanation
- signature for SEPA authorization
- Notification on debt calculation
- Notification on debt validation
- email notifications
- devolutions
- don't allow deletion of product categories if they are in use

unify permissions denied messages ✓ COMPLETED - Created unified AccessDenied component - Updated ProtectedRoute to use AccessDenied - Updated CreditsPage to use ProtectedRoute instead of custom access control - Updated NotesManagementPage to use AccessDenied - All admin pages now show consistent access denied message

Use specific folder for pages different from componentes ✓ COMPLETED - Moved all Page components from /components to /pages - Moved dashboard folder to /pages/dashboard - Moved announcements folder to /pages/announcements - Updated all import statements in App.tsx - Updated cross-references in NotesManagementPage - Components folder now contains only shared UI components

Fix missing Spanish translations ✓ COMPLETED - Added 40+ missing Spanish translations to match Basque translations - Fixed duplicate translation keys causing TypeScript errors - All translation keys now exist in both languages - TypeScript check now passes without errors

Prevent deletion of product categories in use ✓ COMPLETED - Added backend validation to check for active products using category - Updated DELETE endpoint to return 400 error if category is in use - Added proper error handling in frontend with toast notifications - Added translation keys for category in use error messages - TypeScript check passes without errors

Mutliple society management
