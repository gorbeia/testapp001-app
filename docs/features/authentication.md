# User Stories: Authentication & User Management

> Implementation status: see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md#1-authentication--user-management-authenticationmd)

## Epic: User Authentication

### Story 1: User Login
**As a** Bazkidea (socio) or Laguna (acompañante)  
**I want to** log in to the application with my email and password  
**So that** I can access the society's management system  

**Acceptance Criteria:**
- Login form requires email and password
- System validates credentials against PostgreSQL database via real API
- Upon successful login, user is redirected to dashboard
- Error messages appear for invalid credentials
- Session is maintained across the application
- **Implementation**: Real API endpoint `/api/login` with database-backed credentials and bcrypt password hashing
- **Testing**: E2E tests validate complete login flow and role-based access control
- **Note**: User data (name, role, function, etc.) is now real from database; session management implemented

### Story 2: Role-Based Access Control
**As a** system  
**I want to** detect the user's role (Bazkidea/Laguna) and administrative function  
**So that** I can provide appropriate access and menu options  

**Acceptance Criteria:**
- System identifies user type after login
- For Bazkidea, checks for administrative functions (Administratzailea, Diruzaina, Sotolaria)
- Menu adapts based on detected role
- Access restrictions enforced for different functionalities
- Direct URL access blocked for unauthorized users
- **Implementation**: Fully implemented - frontend route protection + backend API middleware + database roles
- **Testing**: E2E tests validate role-based menu visibility and access restrictions
- **Security**: Both frontend routes and backend endpoints protected by role middleware

## Epic: User Management (Administratzailea)

### Story 3: Create New User
**As an** Administratzailea (Administrator)  
**I want to** create new user accounts  
**So that** new members can access the application  

**Acceptance Criteria:**
- Form to create new users with required fields
- Assign user type: Bazkidea or Laguna
- Assign administrative functions if applicable
- Link Laguna to a Bazkidea (required for Laguna users)
- Generate initial password or allow user creation with temporary password
- **Implementation**: Fully implemented - UsersPage + real `/api/users` POST endpoint + database integration
- **Testing**: Create dialog wired and E2E tested
- **Database**: Users table with proper schema and seed script

### Story 4: Manage User Roles
**As an** Administratzailea  
**I want to** modify user roles and functions  
**So that** I can maintain proper access control as responsibilities change  

**Acceptance Criteria:**
- List all users with current roles
- Ability to change user type (Bazkidea ↔ Laguna)
- Ability to assign/remove administrative functions
- Maintain Bazkidea-Laguna relationships
- Audit trail of role changes
- **Implementation**: Not Implemented - UI exists but backend role management pending

### Story 5: User Directory
**As an** Administratzailea  
**I want to** view and search all users  
**So that** I can manage the society membership effectively  

**Acceptance Criteria:**
- Searchable list of all users
- Filter by user type and administrative function
- View user details including contact information
- Export user list for administrative purposes
- **Implementation**: Fully implemented - UsersPage table + filters backed by `/api/users` GET endpoint
- **Database**: Seeded demo users for testing and demonstration
- **Features**: Real-time search and filtering functionality

## Epic: User Profile Management

### Story 6: View Personal Profile
**As a** Bazkidea or Laguna  
**I want to** view my personal profile information  
**So that** I can verify my details and understand my access level  

**Acceptance Criteria:**
- Display personal information (name, email, role)
- Show linked user relationships (Bazkidea ↔ Laguna)
- Display current administrative functions if any
- Option to edit personal information (limited fields)
- **Implementation**: Not Implemented - profile viewing functionality pending

### Story 7: Update Password
**As a** user  
**I want to** change my password  
**So that** I can maintain account security  

**Acceptance Criteria:**
- Form to change password with current password verification
- Password strength validation
- Confirmation of successful password change
- Automatic logout after password change for security
- **Implementation**: Not Implemented - password change flow pending
