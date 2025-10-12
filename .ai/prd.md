# Product Requirements Document (PRD) - AI Trainer (MVP)

## 1. Product Overview

### 1.1. Purpose and vision
AI Trainer (MVP) helps gym newcomers start training without confusion or anxiety. The product automates the planning of single workout sessions and their progression so the user can focus on execution. Vision: a supportive training partner that continuously adapts the session to the user’s goal, history, available equipment, and perceived difficulty.

### 1.2. Value proposition
Unlike passive workout trackers, AI Trainer actively generates and adapts a session plan. Positioning: Your workout, planned by AI.

### 1.3. Platform and technical scope
- Platform: React Native/Expo (iOS and Android), mobile-first.
- Backend communicates with an LLM via OpenRouter API.
- Exercise and equipment knowledge is accessed via MCP (Model Context Protocol).
- Every LLM response is validated against the exercise database and available equipment to prevent hallucinations and unsafe suggestions.

### 1.4. MVP scope (summary)
- Onboarding: minimal data capture (gender, primary goal, weekly workout frequency).
- Generate a single workout session at a time based on the user’s inputs and history.
- Logging: sets, reps, load, ability to mark a set not completed, and perceived difficulty per exercise.
- Post-workout summary.
- Suggestions for the next session informed by history and areas for improvement.

### 1.5. Assumptions and dependencies
- App language: English (MVP).
- Units: kilograms (kg) only.
- Network required for generation; workout logging supports limited connectivity with background sync.
- LLM cost monitoring with regeneration limits and safe local fallbacks.

## 2. User Problem

Newcomers feel lost at the gym: they do not know where to start, which exercises to perform, what weight to choose, or how to progress safely. This uncertainty reduces motivation and consistency. AI Trainer removes the planning barrier, reduces decision fatigue, and supports habit formation by providing a clear, realistic, and adaptive session with simple logging and a motivating summary.

## 3. Functional Requirements

### 3.1. Authentication and access
- Supported methods: email/password and social login via Apple and Google.
- Session persistence with secure token storage and automatic refresh when possible; require re-login when expired.
- Password reset via email.
- Minimal profile telemetry; editing profile/goals is out of scope for MVP.

### 3.2. Onboarding
- Screen 1: Gender selection (optional; may influence tone/communication only).
- Screen 2: Primary goal (Build Strength, Lose Weight, Improve Fitness) with an optional custom free-text goal.
- Screen 3: Weekly workout frequency (2, 3, 4, 5+).
- Completing onboarding immediately triggers generation of the first session.
- Validations: required fields, clear error messages, ability to go back and edit before submission.

### 3.3. AI session generation
- Generate a single complete workout session at a time, not a full weekly plan.
- Inputs: goal, history (results and feedback), inferred level, and equipment constraints.
- OpenRouter LLM response must match a strict JSON schema and is validated:
  - Each exercise must exist in the MCP database.
  - Required equipment must be available.
  - Each set includes target load (kg), target reps, and rest time (sec), and the exercise order is defined.
- On validation error or LLM failure, use safe fallbacks: substitute exercises from the same muscle group or use a rule-based template aligned with the goal.
- Cost control: limit per-session regenerations (for example, max 2 regenerations per session).

Representative, non-binding JSON fields:
- workoutId, createdAt
- exercises[]: exerciseId, name, primaryMuscles[], equipment[], notes?
- sets[]: targetLoadKg, targetReps, restSec

### 3.4. Workout logger (UI and behavior)
- Exercise tiles in a vertical list, each with a table of sets.
- Table columns: set number, previous performance, suggested kg, suggested reps, editable inputs for actual performance, and a checkbox to mark set complete.
- Suggested values are prefilled; the user may adjust before completion.
- Per exercise perceived difficulty: Too Easy, OK, Too Hard (single choice per exercise).
- Ability to mark a set as not completed.
- When a set is marked complete, the rest timer starts automatically with the suggested duration.

### 3.5. Session management
- Autosave active session locally. On relaunch, prompt to resume or discard.
- Rest timer supports pause/resume and restores properly after app switching.
- End session after all sets are complete or with explicit early-finish confirmation.

### 3.6. Post-workout summary
- Key metrics: total session duration, total tonnage (sum of load × reps), a light-hearted tonnage comparison, and primary muscle groups engaged.
- Consistently positive, encouraging tone.
- Summary is stored locally and synced to the backend when online.

### 3.7. Validation and content safety
- Every AI response is validated against MCP and equipment rules.
- Exercises not in MCP or requiring unavailable equipment are rejected and substituted.
- Fallback behavior mirrors section 3.3.

### 3.8. Non-functional requirements
- Performance: session generation ≤ 3 s P50, ≤ 7 s P95; logging is instant and local, with background sync.
- Reliability: offline-capable logging with queued retry and exponential backoff.
- Accessibility: contrast, font sizes, focus states, small-screen readability; VoiceOver/TalkBack for key actions.
- Privacy and security: data minimization; secure token storage; TLS; no video/biometrics; comply with Apple/Google Sign-In guidelines.
- Analytics: events to measure activation and engagement (onboarding_completed, workout_generated, workout_completed, weekly_active_user).
- Cost controls: regeneration limits, prompt instruction caching, local fallbacks.

## 4. Product Boundaries

- No monetization (subscriptions, ads, IAP).
- No advanced analytics or historical progress charts.
- No post-onboarding profile or goal editing (MVP).
- No user modifications to AI-generated plans (add/remove/substitute exercises).
- No social features, no AI chat, no instructional videos/text.
- No gamification (badges, achievements, streaks).
- Kilograms only (kg).
- Mobile only (iOS/Android via RN/Expo); no web.

## 5. User Stories

Each story includes an ID, title, description, and acceptance criteria. Scenarios cover happy paths, alternatives, and edge cases. All are testable.

### US-001. Email sign up
Description: As a new user, I want to create an account with email and password so I can save my workouts.
Acceptance criteria:
- Form requires a valid email and a password that meets complexity policy.
- On success, the account is created and the user is signed in.
- Registering an already-used email shows a clear error.
- If presented, terms/privacy acceptance is required.

### US-002. Email sign in
Description: As a user, I sign in with email and password to access the app.
Acceptance criteria:
- Valid credentials sign in and route to the home screen or onboarding if not completed.
- Invalid credentials show an error without revealing whether the email exists.
- Limit attempts and apply cooldown after repeated failures.

### US-003. Apple Sign-In
Description: As an iOS user, I want to sign in with Apple to start quickly.
Acceptance criteria:
- Native Apple Sign-In launches and returns user identity.
- On consent, the user is signed in or a new account is created.
- User cancellation exits cleanly without side effects.

### US-004. Google Sign-In
Description: As a user, I want to sign in with Google to start quickly.
Acceptance criteria:
- Native Google Sign-In launches and returns user identity.
- On consent, the user is signed in or a new account is created.
- User cancellation exits cleanly without side effects.

### US-005. Password reset
Description: As a user, I want to reset my password if I forget it.
Acceptance criteria:
- Form accepts email and confirms that a reset link is sent if an account exists.
- Link leads to setting a new password that meets policy.
- Success/failure events are logged to analytics.

### US-006. Session persistence and expiry
Description: As a user, I stay signed in across launches until my session expires.
Acceptance criteria:
- Returning to the app keeps me signed in if the session is valid.
- When expired, I must sign in again.
- Tokens are stored securely and never printed to logs.

### US-007. Logout
Description: As a user, I want to sign out of the app.
Acceptance criteria:
- Signing out clears tokens and in-memory session state.
- After sign-out, the sign-in screen is shown.

### US-010. Onboarding: gender selection
Description: As a new user, I select my gender on the first screen.
Acceptance criteria:
- Selection is optional if defined as such; user can proceed without selection.
- State persists if the app is closed during onboarding.

### US-011. Onboarding: primary goal selection
Description: As a new user, I choose a primary goal from a list.
Acceptance criteria:
- List includes Build Strength, Lose Weight, Improve Fitness.
- Selection is required unless a custom goal is entered.
- Validation shows a clear message if missing.

### US-012. Onboarding: custom goal input
Description: As a new user, I can enter a custom goal (e.g., do a muscle-up in 6 months).
Acceptance criteria:
- Text field has a length limit and profanity filter.
- Custom goal overrides the list selection.

### US-013. Onboarding: workout frequency
Description: As a new user, I select weekly workout frequency.
Acceptance criteria:
- Choose one of 2, 3, 4, 5+.
- Required to complete onboarding.

### US-014. Onboarding: review and submit
Description: As a new user, I review and confirm my inputs.
Acceptance criteria:
- I can go back and edit previous steps.
- On submit, first session generation starts.

### US-015. Onboarding resume on app relaunch
Description: As a new user, I can resume an interrupted onboarding after relaunch.
Acceptance criteria:
- After restart, the app offers to resume onboarding.
- Previously entered data is restored.

### US-020. Generate first workout after onboarding
Description: After onboarding, the system generates the first session.
Acceptance criteria:
- A loader is shown while waiting (within NFR time limits).
- The plan passes MCP validation.
- On error, a fallback plan is provided with a clear message.

### US-021. Generate next workout on app open
Description: When opening the app with no active session, the next workout is generated based on history.
Acceptance criteria:
- Previous results and feedback influence suggestions.
- On generation error, a fallback plan is provided.

### US-022. LLM error handling and retry
Description: As a user, I can safely retry generation when it fails.
Acceptance criteria:
- For network/429/500 errors, a Retry button is available.
- Maximum of 2 regenerations per session; then a local fallback is used.

### US-023. Exercise validation and substitution
Description: The system replaces invalid exercises with allowed alternatives.
Acceptance criteria:
- Exercises missing in MCP or requiring unavailable equipment are flagged.
- Each invalid exercise is substituted with a same-muscle-group alternative.
- The resulting plan still satisfies session goals.

### US-025. Cost guardrails
Description: As a product owner, I want to control generation costs.
Acceptance criteria:
- Regeneration limits and backoff for 429 responses are enforced.
- Cost metrics per session are logged.

### US-030. Workout logger: display and prefill
Description: As a user, I see the exercise list with set tables and prefilled suggestions.
Acceptance criteria:
- Each set shows suggested kg, reps, and previous performance.
- Fields are editable before marking the set complete.

### US-031. Enter actuals and complete a set
Description: As a user, I enter actual values and complete the set.
Acceptance criteria:
- Completion requires entering values or explicitly marking not completed.
- Rest timer starts upon completion.
- Completed set is locked to prevent accidental edits; unlocking requires an explicit edit action.

### US-032. Mark set as not completed
Description: As a user, I can mark a set as not completed.
Acceptance criteria:
- Not-completed status is recorded with an optional reason.
- Progression suggestions account for non-completions.

### US-033. Difficulty feedback per exercise
Description: As a user, I rate difficulty per exercise (Too Easy, OK, Too Hard).
Acceptance criteria:
- Only one choice per exercise.
- Feedback influences future generations.

### US-034. Rest timer auto start and controls
Description: As a user, the rest timer starts automatically after completing a set.
Acceptance criteria:
- Timer starts on completion.
- Pause and resume are available.
- Timer state is restored correctly after app switching.

### US-035. Autosave active session
Description: As a user, I do not lose progress if I close the app during a workout.
Acceptance criteria:
- Session state is saved after each user action.
- On return, the app offers resume or discard.

### US-036. Resume or discard active session
Description: As a user, I decide to resume or discard an unfinished session.
Acceptance criteria:
- Resume restores the last known state.
- Discard clears local state without corrupting history.

### US-037. Prevent duplicate submissions
Description: The system prevents double-submitting the same set.
Acceptance criteria:
- Rapid taps do not create duplicates.
- Backend sync deduplicates based on set IDs.

### US-038. Offline logging with queued sync
Description: As a user, I can log workouts without connectivity; data syncs later.
Acceptance criteria:
- Logging works offline; data is queued.
- On connectivity return, sync occurs automatically.
- Conflicts are resolved using last-write-wins with later timestamps.

### US-040. Finish workout and generate summary
Description: As a user, upon finishing a workout I see a summary.
Acceptance criteria:
- Total duration, tonnage, fun comparison, and primary muscle groups are shown.
- Summary is saved locally and synced to the backend when online.

### US-041. Summary generation fallback
Description: On summary generation error, I get a simple local version.
Acceptance criteria:
- For network/LLM errors, a local summary is shown without delay.
- I can dismiss the summary without being blocked.

### US-042. No sharing path in MVP
Description: There is no way to share results from within the app.
Acceptance criteria:
- No share buttons or links are present.
- Exploratory testing cannot find a sharing path.

### US-050. Analytics: activation and engagement
Description: As a product owner, I want to measure activation and habit.
Acceptance criteria:
- Events: onboarding_completed, workout_completed, session_duration, feedback_given.
- Weekly reports of WAU and the percent of users with >3 workouts.

### US-051. Security and privacy baseline
Description: As a user, my data is safe.
Acceptance criteria:
- All connections use TLS.
- Tokens are stored securely; no PII in logs.
- Compliance with Apple/Google Sign-In guidelines.

### US-052. Unit system fixed to kg
Description: As a user, I use kilograms.
Acceptance criteria:
- All loads and metrics are presented in kg.
- No unit switch exists.

### US-053. App availability and performance
Description: As a user, the app feels smooth and responsive.
Acceptance criteria:
- Session generation within stated P50/P95 limits.
- Smooth exercise list scrolling on mid-tier devices.

### US-054. Error states and messaging
Description: As a user, I see clear error messages.
Acceptance criteria:
- Network, validation, and logging errors are presented consistently.
- Messages include actionable guidance (e.g., try again).

## 6. Success Metrics

- Activation and core value: at least 75% of users who complete onboarding go on to complete more than 3 workouts.
- Engagement and habit: at least 25% of active users use the app at least twice per week.
- Leading indicators:
  - Time-to-first-workout from install.
  - Share of started workouts that are completed per week.
  - Distribution of Too Easy/OK/Too Hard feedback (for progression calibration).
  - Average generation time and percentage of fallbacks.
- Instrumentation: analytics events cover onboarding, generation, set logging, workout completion, and feedback, while minimizing cost and privacy impact.
