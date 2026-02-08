# Design Guidelines: Gastronomic Society Management App

## Design Approach

**System-Based Approach**: Material Design 3 principles adapted for productivity and data management

- **Justification**: Utility-focused application requiring clear information hierarchy, consistent data patterns, and efficient task completion across multiple complex workflows
- **Key Principles**: Clarity over decoration, consistency across all modules, accessibility for all user roles, responsive data displays

## Core Design Elements

### A. Typography

**Font Family**: Inter (via Google Fonts CDN)

- **Display/Headers (h1-h2)**: 700 weight, 24-32px
- **Section Headers (h3-h4)**: 600 weight, 18-20px
- **Body Text**: 400 weight, 16px (forms, content)
- **Labels/Meta**: 500 weight, 14px (form labels, table headers, badges)
- **Small Text**: 400 weight, 12px (timestamps, helper text)

**Bilingual Typography**: Ensure consistent line-height (1.6 for body, 1.3 for headers) to accommodate both Euskara and Castellano without layout shifts

### B. Layout System

**Spacing Primitives**: Tailwind units of **2, 4, 6, 8, 12, 16**

- Component padding: `p-4` to `p-6`
- Section spacing: `py-8` to `py-12`
- Card margins: `m-4` to `m-6`
- Form field gaps: `gap-4`
- Table cell padding: `p-2` to `p-4`

**Grid System**:

- Desktop: 12-column grid with `gap-6`
- Tablet: 8-column grid with `gap-4`
- Mobile: Single column with `gap-4`

**Container Strategy**:

- App Shell: Fixed sidebar (280px desktop, collapsible mobile)
- Main Content: `max-w-7xl` with `px-4 md:px-6 lg:px-8`
- Forms/Modals: `max-w-2xl` centered
- Data Tables: Full-width with horizontal scroll on mobile

### C. Component Library

**1. Navigation & App Shell**

- **Top Bar**: Fixed header with society logo, language selector (EU/ES flags), user profile dropdown, notifications badge
- **Sidebar Navigation**: Collapsible menu with icons + labels, role-based visibility, active state indicator, grouped by function (Erreserbak, Kontsumoak, Zorrak, etc.)
- **Breadcrumbs**: Secondary navigation for deep screens (Admin > Erabiltzaileak > Bazkidea Details)

**2. Data Display Components**

- **Tables**: Striped rows, sortable headers (Heroicons arrow icons), sticky header on scroll, row actions menu (3-dot dropdown), responsive stacking on mobile
- **Cards**: Elevated surface with `shadow-md`, `rounded-lg`, header with icon, content area with `p-6`, optional footer actions
- **List Items**: Avatar/icon + title + subtitle + metadata + action button, divider between items
- **Badges**: Role indicators (Bazkidea, Laguna, Diruzaina, etc.) with distinct visual treatment, rounded-full, px-3 py-1, 12px text
- **Status Indicators**: Dot + label for reservation status (confirmed/pending), credit status (paid/pending)

**3. Forms & Input**

- **Text Inputs**: Full-width with label above, `border rounded-md px-4 py-2`, focus ring, error states below field
- **Select Dropdowns**: Native select styled consistently, chevron-down icon (Heroicons)
- **Date/Time Pickers**: Calendar icon prefix, clear interaction pattern
- **Radio/Checkbox Groups**: Vertical stack with `gap-2`, label clickable
- **Number Inputs**: Stepper buttons for quantities (consumiciones), currency format for amounts (€)
- **Search Fields**: Magnifying glass icon prefix, `rounded-full` option for top bar searches

**4. Action Components**

- **Primary Buttons**: `px-6 py-3 rounded-lg`, 600 weight text, with icon support (Heroicons)
- **Secondary Buttons**: Outlined variant, same size/padding
- **Icon Buttons**: Square/circular, `p-2`, for table actions and compact spaces
- **FAB (Floating Action Button)**: Bottom-right on mobile for primary actions (Nueva Reserva, Registrar Consumo)
- **Dropdown Menus**: Elevated, `rounded-md shadow-lg`, icon + label items

**5. Feedback Components**

- **Toast Notifications**: Top-right position, auto-dismiss, success/error/info variants with icons
- **Modal Dialogs**: Centered overlay, `max-w-2xl`, header + scrollable content + sticky footer actions
- **Confirmation Dialogs**: Compact modal for destructive actions, clear primary/secondary buttons
- **Loading States**: Spinner for async operations, skeleton screens for data tables
- **Empty States**: Centered illustration placeholder + descriptive text + CTA button

**6. Specialized Components**

- **Reservation Calendar**: Month/week view toggle, color-coded event types, day/time grid with availability
- **Consumption Cart**: Sticky panel with running total, item list with quantities, "Cerrar Cuenta" action
- **Credit Summary Card**: Large number display, trend indicator, breakdown by month
- **SEPA Export Panel**: Multi-step wizard (select month → review amounts → generate file), preview table before export
- **User Profile Cards**: Avatar + name + role badge + contact actions, used in admin user management
- **Chat Interface**: Message bubbles (sender/receiver alignment), timestamp, typing indicator, message input with send button

**7. Icons**
**Library**: Heroicons (via CDN) for all interface icons

- Navigation: home, calendar, shopping-cart, currency-euro, users, chat-bubble, bell, document
- Actions: plus, pencil, trash, check, x-mark, arrow-down-tray (download)
- Status: check-circle, exclamation-circle, information-circle

### D. Animations

**Minimal & Purposeful Only**:

- Sidebar collapse/expand: 200ms ease-in-out
- Dropdown menus: 150ms fade-in
- Toast notifications: Slide-in from top-right, 200ms
- Modal overlays: Fade backdrop 150ms, scale content 200ms
- **NO** scroll animations, hover effects kept simple (opacity/underline only)

## Special Considerations

**Bilingual Implementation**:

- Language toggle in top bar (EU/ES flags or text labels)
- Store language preference in localStorage
- Ensure all labels, buttons, error messages have both translations
- Table headers and form labels should not break layout when language switches

**Role-Based UI**:

- Dynamically show/hide navigation items based on user role
- Admin functions (Erabiltzaileak management) only visible to Administratzailea
- Diruzaina sees Zorrak with export options
- Sotolaria sees Produktuak inventory management
- All see Erreserbak, Kontsumoak, Oharrak, Txata

**Mobile-First Considerations**:

- Collapsible sidebar becomes bottom navigation bar on mobile
- Tables convert to card lists with stacked data
- Multi-step forms use wizard pattern with progress indicator
- FAB for primary actions instead of top-bar buttons

**Data Density**:

- Use compact spacing for tables (`p-2`)
- Group related info in cards to reduce scrolling
- Implement pagination for long lists (20-50 items per page)
- Provide filtering and search for all major data tables

## Images

**No hero images** - This is a utility application, not a marketing site. Visual elements limited to:

- Society logo in top bar (100x40px max)
- User avatars (40x40px circular)
- Empty state illustrations (simple, line-art style, 200x200px)
- Icons from Heroicons only
