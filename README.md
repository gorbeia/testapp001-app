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

End-to-end tests are implemented using **Playwright** and **Cucumber/Gherkin**. Currently there is a minimal test that verifies the **login page** loads correctly.

### One-time setup

1. **Install Playwright browsers**
   ```bash
   pnpm exec playwright install
   ```

This downloads Chromium/Firefox/WebKit binaries used by Playwright.

### Running E2E tests

1. **Start the application** (in one terminal):

   ```bash
   pnpm dev
   ```

2. **Run the E2E test suite** (in another terminal):
   ```bash
   pnpm test:e2e
   ```

This runs Cucumber with:

- Features in `e2e/features/**/*.feature` (e.g. `e2e/features/login.feature`)
- Step definitions in `e2e/steps/**/*.js` (e.g. `e2e/steps/login.steps.js`)

You should see output similar to:

```text
1 scenario (1 passed)
3 steps (3 passed)
```

### Structure

- `e2e/features/login.feature`
  - Gherkin feature that describes visiting the login page.
- `e2e/steps/login.steps.js`
  - Playwright-powered step definitions (ES modules) that:
    - Launch Chromium
    - Open `http://localhost:5000/`
    - Assert that the login form inputs are present.

---

## Available Scripts

- `pnpm dev` – Start development server
- `pnpm build` – Create production build
- `pnpm start` – Start production server
- `pnpm check` – TypeScript type checking
- `pnpm db:push` – Apply database schema via Drizzle
- `pnpm docker:db:up` – Start PostgreSQL via Docker Compose
- `pnpm docker:db:down` – Stop PostgreSQL
- `pnpm docker:db:reset` – Reset PostgreSQL volume
- `pnpm test:e2e` – Run E2E tests (Playwright + Cucumber)
