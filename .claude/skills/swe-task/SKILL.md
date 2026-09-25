---
name: swe-task
description: Take a Linear task (team Sweaty, SWE-<id>) from choosing it to a ready pull request in this repo — pick it with the user, start it in Linear, branch, implement with tests, run the CI-like quality gate, keep the database safe, and hand over the git commands. Use when the user runs /swe-task, asks for the next task, or names a SWE issue to work on.
argument-hint: "[SWE-123]"
---

# /swe-task

Input: `$ARGUMENTS`, an optional `SWE-<id>`.

Follow `AGENTS.md` throughout (conventions, Linear rules, docs). This skill adds the workflow on top of it.

## Hard rules

- **Database.** Never run anything against a database, local or remote: no `supabase db reset` or `db push`, `psql`, SQL editors or seed scripts. Losing production data is the worst outcome in this repo.
  - Data migrations are insert-only (`INSERT … ON CONFLICT … DO NOTHING`).
  - No `DELETE`, `TRUNCATE`, `DROP`, or `UPDATE` of existing rows, unless the user explicitly asks for that exact change.
  - Migrations are applied to production by hand; CI never applies them.
- **Git.** Don't run `git commit`, `git push`, `gh pr create` or `gh pr merge` unless the user asks for that action in this conversation. Hand over the commands instead (step 8). Creating a local branch from `origin/main` is fine.
- **Merging.** Never merge without the user's explicit OK for that PR. GitHub auto-merge is disabled in this repo.
- **Linear.** Only the status moves in steps 2 and 8 happen without asking. Ask before any other status change, comment or new issue.

## 1. Choose the task

If `$ARGUMENTS` names an issue, read it (description, comments, attachments) and go to step 2. If it's already In Review, Done or Canceled, stop and tell the user.

Otherwise, always give the user a choice and never pick on your own:

1. **List candidates.** List Todo and Backlog issues in team Sweaty, and what's In Progress or In Review, so you don't duplicate another session's work.
2. **Read comments.** Read the comments on candidates. "Partially done … Missing: …" comments often leave a small, concrete remainder.
3. **Check open PRs.** Check the files touched by open PRs (`gh pr list --state open`, `gh pr view N --json files`) and flag tasks that would conflict.
4. **Prefer verifiable tasks.** Prefer tasks you can verify here. This machine has no Supabase CLI, psql or Docker, and CI runs neither SQL nor Deno tests, so SQL and RPC changes can't be tested.
5. **Offer options.** Offer 3–4 options with `AskUserQuestion`, recommended one first. For each, give its size and risk, likely PR conflicts, and whether it needs a migration or a new dependency.

## 2. Start

- Move the issue to In Progress and set `assignee: "me"` in the same update. If it belonged to someone else, reassign it and tell the user.
- If the working tree has uncommitted changes, stop and show them. Otherwise run `git fetch origin`, then `git checkout -b SWE-<id>-<short-kebab-description> origin/main`.

## 3. Understand

- Re-read the issue scope and acceptance criteria, and check its comments.
- Look for existing helpers and patterns before writing new ones: neighbouring files, `hooks/`, `lib/`. For example, the app language comes from `useAppCatalogLanguage()`.
- Ask before implementing if the scope is ambiguous, conflicts with `PROJECT.md`, or needs a migration or a new dependency.

## 4. Implement

- Match the surrounding code and `AGENTS.md`:
  - `interface` over type aliases, and no `enum`;
  - every UI string goes in `i18n/locales/en` and `i18n/locales/pl`;
  - styles through `StyleSheet.create()`.
- Keep the change scoped to the issue. Note unrelated problems as follow-ups instead of fixing them.

## 5. Test

- Add or update tests that cover the acceptance criteria.
- **Mutation check.** Temporarily revert the fix (or move the migration aside), confirm the new test fails, then restore the file and confirm the test passes again.
- **Known traps:**
  - **TanStack Query** notifies observers on a later tick. After `await act(() => refetch())`, assert with `waitFor`, or call `rerender` before asserting that a value did _not_ change.
  - **Date-only strings** (`YYYY-MM-DD`) parse as UTC midnight. Format them with `timeZone: "UTC"`, and for date code also run the tests with `TZ=America/New_York`.
  - **Node built-ins.** The app tsconfig has no Node types in CI, so tests that need `fs` use `jest.requireActual<LocalInterface>("fs")` and `declare const __dirname: string`.
  - **Flaky test.** `stores/__tests__/workout-store.test.ts` › "keeps a failed watch Health export retryable after summary dismissal" is flaky in full runs.

## 6. Verify

- Run `/ci-check`, or `bash .claude/skills/ci-check/ci-check.sh`. Report failures honestly, including anything you couldn't run.
- If the change touches `supabase/`, check the diff again for destructive statements, and state what each migration does.

## 7. Docs

Update docs in the same change when behaviour, setup, invariants or the database shape change (see `AGENTS.md` → Working Style). For example, data rules go in `.ai/db-schema.md`.

## 8. Review and hand-off

1. **Code review.** Ask the user whether to run `/code-review` (e.g. `high --fix`) before the PR. Don't run it unasked.
2. **PR body.** Write it in English to the scratchpad as `pr-body-<id>.md`. It contains:
   - a summary of the change;
   - a ⚠️ section for any migration, saying it is insert-only and has to be applied by hand;
   - tests and verification results;
   - `Fixes SWE-<id>`. Use a closing keyword, so Linear moves the issue to Done on merge;
   - the attribution lines from the session instructions.
3. **Commands.** Hand them over as one `bash` block containing a single `&&`-chained line, with no line breaks, so one Run click runs everything. End it at `gh pr create`, never at a merge:

   ```bash
   git add <files> && git commit -m "<type>(<scope>): <summary>" -m "<attribution>" && git push -u origin <branch> && gh pr create --repo ogigg/didactic-octo-system --base main --head <branch> --title "SWE-<id> <title>" --body-file <scratchpad>/pr-body-<id>.md
   ```

   - Name the exact files in `git add`, never `-A`.
   - Never stage `apps/mobile/ios/`, `.env` or `tsconfig.tsbuildinfo` noise.
   - Write commit messages as English conventional commits.

4. **After the user opens the PR:**
   - verify it read-only (`gh pr list --head <branch> --json number,url,files`);
   - move the issue to In Review and bind the PR to the session;
   - report the CI status once. Don't poll CI.
5. **Follow-ups.** Suggest 2–3 of them. Create Linear issues only if asked.
