# Technical Documentation: Elkartearen App

## 1. Project Overview
**Elkartearen App** is a modern web application built with a full-stack TypeScript architecture, featuring a React frontend and an Express.js backend. The application follows a client-server architecture with a clear separation of concerns.

## 2. Technology Stack

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **UI Components**: Radix UI Primitives
- **Styling**: Tailwind CSS with custom theming
- **State Management**: React Query (TanStack Query)
- **Form Handling**: React Hook Form with Zod validation
- **Routing**: Wouter
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Date Handling**: date-fns
- **Charts**: Recharts

### Backend
- **Runtime**: Node.js with TypeScript (tsx)
- **Web Framework**: Express.js
- **Authentication**: Passport.js with local strategy
- **Session Management**: express-session with PostgreSQL session store
- **Database**: PostgreSQL with Drizzle ORM
- **API Validation**: Zod
- **WebSockets**: ws

### Development Tools
- **Type Checking**: TypeScript 5.6
- **CSS Processing**: PostCSS with Autoprefixer
- **Code Formatting**: Prettier
- **Database Migrations**: Drizzle Kit

## 3. Project Structure

```
elkarearen-app/
├── client/                 # Frontend code
│   ├── public/            # Static assets
│   └── src/               # Source code
├── server/                # Backend code
│   ├── db.ts             # Database configuration
│   ├── index.ts          # Server entry point
│   ├── routes.ts         # API routes
│   ├── static.ts         # Static file serving
│   ├── storage.ts        # File storage utilities
│   └── vite.ts           # Vite development server
├── shared/               # Shared code between client and server
├── .gitignore           # Git ignore rules
├── package.json         # Project dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── tailwind.config.ts   # Tailwind CSS configuration
└── vite.config.ts       # Vite configuration
```

## 4. Key Features

### Authentication System
- Email/password authentication using Passport.js
- Session management with secure cookies
- Protected routes and API endpoints

### Database Layer
- Type-safe database access with Drizzle ORM
- PostgreSQL for data persistence
- Database migrations support

### Frontend Architecture
- Component-based UI with Radix UI primitives
- Responsive design with Tailwind CSS
- Client-side state management with React Query
- Form handling with validation using React Hook Form and Zod

### Development Experience
- Hot Module Replacement (HMR) with Vite
- TypeScript for type safety
- Environment-based configuration

## 5. Development Setup

### Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL (v14+)
- pnpm (or npm/yarn)

### Installation
```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
pnpm dev
```

### Available Scripts
- `dev`: Start development server
- `build`: Build for production
- `start`: Start production server
- `check`: Type checking
- `db:push`: Push database schema changes

## 6. Deployment

### Build Process
```bash
# Install dependencies
pnpm install --production

# Build the application
pnpm build

# Start the production server
pnpm start
```

### Environment Variables
Required environment variables:
```
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
SESSION_SECRET=your-session-secret
NODE_ENV=production
```

## 7. Security Considerations

- **Session Security**: Uses HTTP-only, secure cookies
- **CSRF Protection**: Implemented for state-changing operations
- **Input Validation**: All user input validated with Zod
- **Secure Headers**: Configured in the Express server
- **Dependencies**: Regularly updated to patch vulnerabilities

## 8. Performance Optimizations

- **Code Splitting**: Automatic with Vite
- **Tree Shaking**: Dead code elimination
- **Lazy Loading**: For non-critical components
- **Image Optimization**: Via Vite's asset handling

## 9. Testing

### Unit Tests
```bash
# Run unit tests
pnpm test:unit
```

### Integration Tests
```bash
# Run integration tests
pnpm test:integration
```

## 10. Error Handling

- Global error boundary in React
- Centralized error handling in Express
- Structured error responses from the API
- Client-side error logging

## 11. Monitoring and Logging

- Server-side request logging
- Error tracking integration
- Performance monitoring

## 12. Future Improvements

1. **Testing**: Add comprehensive test coverage
2. **CI/CD**: Set up automated deployments
3. **Containerization**: Add Docker support
4. **API Documentation**: Generate OpenAPI/Swagger docs
5. **Performance Monitoring**: Add APM tools

## 13. License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
