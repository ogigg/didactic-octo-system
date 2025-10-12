# AI Trainer - Technical Architecture

## System Overview

The AI Trainer is a mobile-first application built with React Native, leveraging Supabase as the primary backend infrastructure and OpenRouter for LLM-powered workout generation. The architecture follows a serverless pattern with edge functions handling AI orchestration.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Mobile Client                          │
│                   (React Native + Expo)                     │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Onboarding  │  │    Workout   │  │   Summary    │    │
│  │    Flow      │  │    Logger    │  │    Screen    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    Supabase Client
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Supabase Backend                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              PostgreSQL Database                     │  │
│  │  - users, profiles, exercises                        │  │
│  │  - workouts, workout_exercises, logged_sets          │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Supabase Auth                           │  │
│  │  - User authentication & session management          │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │         Edge Functions (Deno Runtime)                │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────┐        │  │
│  │  │  generate-workout                       │        │  │
│  │  │  - Fetch user history                   │        │  │
│  │  │  - Filter available exercises           │────────┼──┼─┐
│  │  │  - Build AI prompt                      │        │  │ │
│  │  │  - Call OpenRouter API                  │        │  │ │
│  │  │  - Validate response                    │        │  │ │
│  │  │  - Store workout plan                   │        │  │ │
│  │  └─────────────────────────────────────────┘        │  │ │
│  │                                                       │  │ │
│  │  ┌─────────────────────────────────────────┐        │  │ │
│  │  │  validate-workout                       │        │  │ │
│  │  │  - Schema validation (Zod)              │        │  │ │
│  │  │  - Exercise existence check             │        │  │ │
│  │  │  - Safety validation                    │        │  │ │
│  │  └─────────────────────────────────────────┘        │  │ │
│  └─────────────────────────────────────────────────────┘  │ │
└─────────────────────────────────────────────────────────────┘ │
                                                                 │
┌────────────────────────────────────────────────────────────────▼─┐
│                        OpenRouter API                            │
│                                                                  │
│  ┌──────────────────┐        ┌──────────────────┐              │
│  │  Claude 3.5      │        │     GPT-4o       │              │
│  │  Sonnet          │        │    (Fallback)    │              │
│  │  (Primary)       │        │                  │              │
│  └──────────────────┘        └──────────────────┘              │
└──────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Mobile Client (React Native + Expo)

**State Management:**
- TanStack Query: Server state, caching, optimistic updates
- Zustand: Local UI state (active workout session, timer)

**Key Responsibilities:**
- User interface rendering
- Workout session persistence (AsyncStorage)
- Real-time rest timer
- Offline-first exercise logging with sync

**Data Flow:**
```
User Action → Component → TanStack Query → Supabase Client → Backend
                ↓
         Local State (Zustand)
                ↓
         AsyncStorage (persistence)
```

### 2. Backend (Supabase)

#### 2.1 PostgreSQL Database

**Schema Design:**
- Normalized relational structure
- Row Level Security (RLS) enabled on all tables
- Automatic timestamps (created_at, updated_at)
- Foreign key constraints with cascade deletes

**Key Tables:**
- `profiles`: User metadata (goal, frequency)
- `exercises`: Exercise library (1000+ entries)
- `workouts`: Workout sessions
- `workout_exercises`: Exercise-workout junction
- `logged_sets`: Individual set performance data

#### 2.2 Authentication

- Email/password (MVP)
- JWT-based session management
- Automatic token refresh
- RLS policies enforce data isolation per user

#### 2.3 Edge Functions

**Function: `generate-workout`**
```typescript
Input: { userId, previousWorkoutId?, preferences? }
Process:
  1. Fetch user profile and goals
  2. Retrieve last 3 workouts for context
  3. Filter exercises by equipment/difficulty
  4. Build structured prompt with exercise IDs
  5. Call OpenRouter API
  6. Parse and validate JSON response
  7. Insert workout into database
Output: { workoutId, exercises[] }
```

**Function: `validate-workout`**
```typescript
Input: { workoutPlan }
Process:
  1. Zod schema validation
  2. Exercise ID verification against DB
  3. Volume/intensity safety checks
  4. Equipment availability validation
Output: { isValid, errors[] }
```

### 3. AI Layer (OpenRouter)

**Model Selection:**
- Primary: Claude 3.5 Sonnet (best reasoning, JSON reliability)
- Fallback: GPT-4o (if Claude unavailable)

**Prompt Structure:**
```
System Prompt:
  - Role definition (fitness trainer)
  - Output format constraints (strict JSON schema)
  - Safety guidelines

User Prompt:
  - User goal and profile
  - Last 3 workout summaries
  - Available exercises (ID | Name | Muscle Groups)
  - Progressive overload instructions
```

**Response Validation:**
1. JSON parsing
2. Zod schema validation
3. Exercise ID existence check
4. Logical validation (volume, rest periods)

**Anti-Hallucination Strategy:**
- Provide explicit list of allowed exercise IDs in prompt
- Use enum validation in JSON schema
- Backend verification layer
- Retry with feedback on validation failure (max 2 attempts)

## Data Flow Diagrams

### Workout Generation Flow

```
User Opens App
    ↓
Check if workout exists for today
    ↓
NO → Call generate-workout Edge Function
    ↓
Fetch user profile + history
    ↓
Build AI prompt with exercise database
    ↓
OpenRouter API call (Claude 3.5 Sonnet)
    ↓
Receive structured JSON response
    ↓
Validate workout plan
    ↓
Insert into database
    ↓
Return workout to client
    ↓
Display workout logger UI
```

### Workout Logging Flow

```
User logs set (weight, reps)
    ↓
Store in local state (Zustand)
    ↓
Mark set as complete
    ↓
Start rest timer
    ↓
On set completion → Optimistic update (TanStack Query)
    ↓
Background sync to Supabase
    ↓
On workout completion
    ↓
Calculate summary metrics (duration, tonnage)
    ↓
Update workout status → 'completed'
    ↓
Display summary screen
```

## Security Architecture

### Authentication & Authorization
- All requests authenticated via Supabase JWT
- Row Level Security (RLS) policies:
  ```sql
  CREATE POLICY "Users can only access own workouts"
  ON workouts FOR SELECT
  USING (auth.uid() = user_id);
  ```

### Rate Limiting
- Edge Functions: 10 requests/minute per user
- AI generation: 1 request per 30 minutes per user
- Prevents API abuse and cost overruns

### Data Validation
- Client-side: React Hook Form validation
- Backend: Zod schema validation
- Database: CHECK constraints, foreign keys

## Scalability Considerations

### Current MVP Capacity
- Supabase Free Tier: 50,000 monthly active users
- Database: 500MB (sufficient for ~100k workouts)
- Edge Functions: 500k invocations/month

### Scaling Strategy
1. **Phase 1 (0-1k users)**: Free tier sufficient
2. **Phase 2 (1k-10k users)**: Upgrade Supabase to Pro ($25/mo)
3. **Phase 3 (10k+ users)**:
   - Implement Redis caching (Upstash)
   - CDN for static assets
   - Database connection pooling
   - Optimize AI prompts for cost reduction

## Monitoring & Observability

### Error Tracking
- Sentry integration (client + edge functions)
- Custom error boundaries in React Native

### Analytics
- PostHog (user behavior, funnel analysis)
- Supabase Analytics (database metrics)

### AI Monitoring
- Log all OpenRouter API calls
- Track: model used, tokens consumed, latency, cost
- Alert on validation failures (hallucination detection)

## Deployment Pipeline

```
Developer Push → GitHub
    ↓
CI/CD (GitHub Actions)
    ↓
├─ Run TypeScript checks
├─ Run tests (Jest)
├─ Build Expo app
└─ Deploy Edge Functions (Supabase CLI)
    ↓
Production
```

**Expo Deployment:**
- EAS Build for native binaries (iOS/Android)
- OTA Updates for JS bundle updates
- Separate channels: development, staging, production

## Offline Support (Future)

MVP is online-only, but architecture supports offline:
- AsyncStorage for active workout session
- Queue failed mutations (TanStack Query)
- Sync on reconnection

