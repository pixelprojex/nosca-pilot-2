# The daily cycle

A Routine starts a fresh session at 4:48 every morning (Europe/Dublin)
and runs this cycle inside the plan's five-hour cap. Each run writes
`docs/cycles/YYYY-MM-DD.md`; the next run reads the newest one first.
The founder can steer a run by opening an issue titled "Cycle".

## Time (from the session's start)

| By      | State                                                    |
|---------|----------------------------------------------------------|
| 0:30    | Research done, one to three items chosen                 |
| 3:15    | No new implementation work started                       |
| 4:00    | No further code changes                                  |
| 4:30    | Every pull request merged, main green                    |
| 4:45    | Summary file merged                                      |
| 4:50    | Nothing in flight                                        |

A piece of work that cannot make these is left out and written down.
Stability and a clean main beat feature count.

## Phases

1. **Research.** `git log --oneline -40`, open pull requests and issues,
   the previous summary, the suites under `scripts/e2e`, and a
   screenshot sweep of the current build (`polish-shots.cjs`), read by
   eye. Pick the smallest, most certain items first; fix what is broken
   or inconsistent before adding anything. Never redesign what
   CLAUDE.md records the founder asked to keep.
2. **Implementation.** Branch `claude/daily-YYYY-MM-DD` from
   `origin/main`; small atomic commits; the architecture in CLAUDE.md.
   No test is disabled, skipped or weakened. No force-push, no history
   rewriting, no direct changes to the live Supabase project or
   Netlify. No model names in commits, pull requests or code.
3. **Quality assurance.** `npm run check`, `npm run build`,
   `supabase/test/run.sh` when nosca.sql changed, a mock build, every
   suite under `scripts/e2e` against it (at most two Playwright jobs at
   once), the seed sweep, the dead-ends crawl, the walkthrough
   alignment, and the screenshot sweep, read by eye.

## Publishing

Push the branch, open a pull request that says what changed and how it
was verified, merge it (merge commit) once green. Then write the
summary file, push, open a second small pull request and merge it. If
the GitHub tools are missing from the session, merge locally:
`git fetch origin main && git checkout -B main origin/main &&
git merge --no-ff claude/daily-YYYY-MM-DD && git push origin main`.

## The summary file

```
# YYYY-MM-DD

Elapsed: Xh Ym of 5h.

## Done
- what changed, in one line each, with the pull request number

## Verified
- check, build, SQL suite (if run), each e2e suite with its count,
  seed sweep, dead ends, walkthrough, screenshots read

## Found, not fixed
- each with where it is and what was seen

## Next
- recommendations in priority order, smallest and most certain first
```
