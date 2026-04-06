# User Stories: Internationalization (Euskara/Castellano)

> Implementation status: see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md#9-internationalization-euskaracastellano-internationalizationmd)

## Shipped implementation (summary)

- **SPA:** large **`translations`** map in **`client/src/lib/i18n.ts`** (keys with **`eu`** and **`es`**); default **`eu`**.
- **`LanguageProvider`:** **`LanguageToggle`** in the header; preference persisted in **`localStorage`** (`language` key); sets **`document.documentElement.lang`**.
- **Server:** i18n middleware influences API / Accept-Language handling (see `server/lib/i18n/`).
- **DB-backed bilingual content:** **`category_messages`**, **`note_messages`** (and related APIs) store per-language strings instead of hardcoded UI keys.
- **Gaps:** some components still contain hardcoded user-visible strings; there is no EU/ES in URL paths for the SPA; profile-stored locale is not implemented.

## Epic: Language Support

### Story 1: Primary Language (Euskara)

**As a** user  
**I want to** use the application primarily in Euskara  
**So that** the application respects the local language priority

**Acceptance Criteria:**

- **Shipped:** Euskara default and primary key set in `i18n.ts`
- Ongoing: eliminate residual hardcoded strings (audit with `.cursor/skills/audit-i18n/SKILL.md`)

### Story 2: Secondary Language (Castellano)

**As a** user  
**I want to** switch to Castellano if needed  
**So that** I can use the application in my preferred language

**Acceptance Criteria:**

- **Shipped:** switcher toggles `es`; persistence via **`localStorage`**
- Ongoing: parity on every key; fix stray literals in components

### Story 3: Language Preference Management

**As a** user  
**I want to** set my language preference  
**So that** the application remembers my choice

**Acceptance Criteria:**

- **Partial:** SPA persistence (localStorage) **implemented**
- ❌ Profile-synced locale, automatic browser-locale detection, export — **not implemented**

## Epic: Content Translation

### Story 4: User Interface Translation

**As an** Administratzailea  
**I want to** ensure all UI elements are translated  
**So that** users have complete language support

**Acceptance Criteria:**

- Menu items and navigation
- Form labels and placeholders
- Button text and actions
- Error messages and notifications
- Help text and tooltips

### Story 5: Data Content Translation

**As a** content manager  
**I want to** translate dynamic content  
**So that** all information is accessible in both languages

**Acceptance Criteria:**

- Product names and descriptions
- Announcement content
- System messages and templates
- Category labels and classifications
- User-generated content moderation

### Story 6: Translation Management

**As an** Administratzailea  
**I want to** manage translations efficiently  
**So that** language content stays current

**Acceptance Criteria:**

- Translation update interface
- Missing translation indicators
- Translation review workflow
- Version control for translations
- Professional translation integration

## Epic: Cultural Adaptation

### Story 7: Local Formatting

**As a** user  
**I want to** see dates, numbers, and currency in local format  
**So that** information is presented familiarly

**Acceptance Criteria:**

- Euskara date formatting
- Local number formatting
- Euro currency display
- Time zone handling
- Address formatting standards

### Story 8: Cultural Context

**As a** user  
**I want to** experience culturally appropriate content  
**So that** the application feels locally relevant

**Acceptance Criteria:**

- Local event types (hamaiketako, etc.)
- Cultural terminology preservation
- Local business practices
- Regional holiday recognition
- Community-specific references

## Epic: Technical Implementation

### Story 9: Translation Framework

**As a** developer  
**I want to** implement a robust translation system  
**So that** language support is maintainable

**Acceptance Criteria:**

- **Shipped (partial):** manual key object (`eu`/`es`), hook/API consumed by components, dynamic switching without reload, localStorage persistence
- ❌ Build-time extraction, translation cache layer, TMS integration — **not implemented**

### Story 10: Content Delivery

**As a** system  
**I want to** deliver content in the appropriate language  
**So that** users receive consistent language experience

**Acceptance Criteria:**

- **Partial:** Accept-Language / middleware on API; **DB** stores localized rows for categories and notes
- ❌ URL-prefix i18n routing for the SPA, email template locale selection, export language picker — **not implemented**

## Epic: Quality Assurance

### Story 11: Translation Quality

**As an** Administratzailea  
**I want to** ensure translation quality  
**So that** users receive accurate information

**Acceptance Criteria:**

- Translation review process
- Native speaker validation
- Consistency checking tools
- Error reporting mechanisms
- Continuous improvement workflow

### Story 12: Language Analytics

**As an** Administratzailea  
**I want to** analyze language usage patterns  
**So that** I can optimize language support

**Acceptance Criteria:**

- Language preference statistics
- Usage patterns by language
- Translation gap identification
- User satisfaction metrics
- Performance impact analysis
