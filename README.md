# Elkartearen App

A modern web application built with React, TypeScript, and Express.js for managing a gastronomic society.

## Prerequisites

- Node.js 18+
- pnpm
- Docker & Docker Compose (for database)

## Getting Started

1. **Clone the repository**

   ```bash
   git clone [repository-url]
   cd elkartearen-app
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Update the `.env` file with your configuration.

## Database Setup

1. **Start the PostgreSQL database (Docker)**

   ```bash
   pnpm docker:db:up
   ```

2. **Run database migrations**
   ```bash
   pnpm db:push
   ```

## Running the Application

### Development Mode

```bash
pnpm dev
```

The application will be available at `http://localhost:5000`.

### Production Build

```bash
pnpm build
pnpm start
```

---

## E2E Tests (Playwright + Cucumber)

End-to-end tests are implemented using **Playwright** and **Cucumber/Gherkin** with TypeScript. The suite includes 12 comprehensive features covering authentication, user management, reservations, and real-time features.

### One-time setup

1. **Install Playwright browsers**
   ```bash
   pnpm exec playwright install
   ```

2. **Set up test database**
   ```bash
   pnpm docker:db:up
   pnpm db:seed
   ```

This downloads Chromium/Firefox/WebKit binaries and seeds the database with test users.

### Running E2E tests

1. **Start the application** (in one terminal):
   ```bash
   pnpm dev
   ```

2. **Run the E2E test suite** (in another terminal):
   ```bash
   pnpm test:e2e
   ```

3. **Run only tagged tests** (for development):
   ```bash
   pnpm test:e2e:only
   ```

4. **Run a specific feature file**:
   ```bash
   pnpm test:e2e:feature e2e/features/login.feature
   ```

This runs Cucumber with:

- Features in `e2e/features/**/*.feature` (12 feature files)
- TypeScript step definitions in `e2e/steps/**/*.ts`
- Test environment: `NODE_ENV=test`
- Default timeout: 10 seconds

### Environment Variables

- `E2E_HEADED=false` - Run tests in headless mode (default)
- `E2E_HEADED=true` - Run tests with visible browser

### Test Coverage

The E2E suite covers:
- Authentication and authorization (multiple user roles)
- User management and profiles
- Product and consumption management
- Reservation management and cancellation
- Society management
- Real-time debt calculation
- Notifications system

### Structure

- `e2e/features/` - Gherkin feature files (12 features)
  - `login.feature` - Authentication scenarios
  - `reservation-management.feature` - Reservation CRUD operations
  - `user-profile.feature` - User profile management
  - And 9 more comprehensive features
- `e2e/steps/` - TypeScript step definitions
  - `login.steps.ts` - Authentication step definitions
  - `shared-state.ts` - Browser/page state management
  - Additional step files for each feature area

---

## Available Scripts

- `pnpm dev` – Start development server
- `pnpm build` – Create production build
- `pnpm start` – Start production server
- `pnpm check` – TypeScript type checking
- `pnpm db:push` – Apply database schema via Drizzle
- `pnpm db:seed` – Seed database with test data
- `pnpm db:reset` – Reset and migrate database
- `pnpm docker:db:up` – Start PostgreSQL via Docker Compose
- `pnpm docker:db:down` – Stop PostgreSQL
- `pnpm docker:db:reset` – Reset PostgreSQL volume
- `pnpm test:e2e` – Run E2E tests (Playwright + Cucumber)
- `pnpm test:e2e:only` – Run only tagged E2E tests
- `pnpm test:e2e:feature <feature-file>` – Run a specific feature file
