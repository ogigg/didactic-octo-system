# Tech Stack

## Frontend

### Mobile
- **React Native** - Cross-platform mobile framework
- **Expo (SDK 52+)** - Development tooling and managed workflow
- **Expo Router** - File-based navigation
- **TypeScript** - Type safety

### State Management
- **TanStack Query (React Query)** - Server state management and caching
- **Zustand** - Lightweight local state management

### Forms & Validation
- **React Hook Form** - Form handling
- **Zod** - Runtime type validation

### UI Components
- **React Native Paper** (optional) - Material Design components
- **Expo Vector Icons** - Icon library

---

## Backend

### Infrastructure
- **Supabase** - Backend-as-a-Service platform
  - PostgreSQL database (managed)
  - Authentication & user management
  - Row Level Security (RLS)
  - Realtime subscriptions
  - Storage (optional, for exercise media)

### Serverless Functions
- **Supabase Edge Functions** - Deno-based serverless functions
  - Workout generation logic
  - AI orchestration
  - Validation layer

---

## Database

### Primary Database
- **PostgreSQL** (via Supabase) - Relational database
  - User profiles
  - Exercise library
  - Workout sessions
  - Performance logs

### ORM / Query Builder
- **Supabase JS Client** - Auto-generated typed queries
- **Drizzle ORM** (optional alternative) - Type-safe ORM

---

## AI / LLM

### API Gateway
- **OpenRouter** - Unified LLM API gateway
  - Access to multiple models
  - Automatic fallback routing
  - Cost optimization

### Models
- **Claude 3.5 Sonnet** (Anthropic) - Primary model for workout generation
- **GPT-4o** (OpenAI) - Fallback model

### Prompt Management
- **Zod** - JSON schema enforcement for LLM outputs
- **Langchain** (optional future) - Advanced prompt orchestration

---

## Development Tools

### Code Quality
- **ESLint** - JavaScript/TypeScript linting
- **Prettier** - Code formatting
- **TypeScript** - Static type checking

### Testing
- **Jest** - Unit and integration testing
- **React Native Testing Library** - Component testing
- **Playwright** (future) - E2E testing

### Version Control
- **Git** - Source control
- **GitHub** - Repository hosting

---

## Deployment & CI/CD

### Mobile Deployment
- **EAS Build** - Native app builds (iOS/Android)
- **EAS Submit** - App store submission automation
- **EAS Update** - Over-the-air JavaScript updates

### Backend Deployment
- **Supabase CLI** - Edge function deployment
- **GitHub Actions** - CI/CD pipeline

---

## Monitoring & Analytics

### Error Tracking
- **Sentry** - Error monitoring and crash reporting

### Analytics
- **PostHog** - Product analytics and feature flags

### Performance
- **Expo Performance Monitoring** - React Native performance metrics

---

## External APIs & Services

### Exercise Data
- **ExerciseDB API** (RapidAPI) - Exercise library seeding
- **WGER API** (alternative) - Open-source exercise database

### Authentication
- **Supabase Auth** - Email/password, OAuth providers

---

## Development Environment

### Package Manager
- **npm** or **pnpm** - Dependency management

### Runtime
- **Node.js 20+** - JavaScript runtime
- **Deno** - For Supabase Edge Functions

### Environment Management
- **dotenv** - Environment variable management
- **Expo Constants** - Expo-specific env vars

