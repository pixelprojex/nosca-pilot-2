# The daily cycle

A Routine fires at 4:48 every morning (Europe/Dublin) — twelve minutes
before five, so it is not queued behind everything else scheduled on
the hour — into the founder's standing session, which keeps its memory
of the project, and runs this cycle inside the plan's five-hour cap.
Each run writes `docs/cycles/YYYY-MM-DD.md`; the next run reads the
newest one first, then `docs/research/`. The founder can steer a run by
opening an issue titled "Cycle". Nothing in a run waits for approval.

## What a run is for

**One large improvement the founder notices, every run.** After the
first two runs the founder said the cycles delivered "only minor
tweaks" and asked for "large scale improvements that are noticeable
while not interfering with anything we worked so hard on", and to make
real use of the research time. So a run is not three small certain
fixes. It is:

1. **One large item** — a new capability, or a new screen, that a coach
   or a player would notice inside their first minute with the build:
   something they could not do yesterday. It comes from the research
   brief (below), it is grounded in what the reference products do and
   what a coach in one of the six sports would expect, and it ships
   whole: the screen, both roles where parity applies, the e2e suite
   that proves it, the CLAUDE.md bullet, the e2e README row.
2. **At most one small fix** from the previous summary's "Next" list,
   only if it fits after the large item is done and verified.

The large item alternates between functional (something that works
that did not) and visual (something the founder can see that reads
better) across runs, unless the brief's top item is clearly one kind.
The small fix is the other kind.

**Protected.** Everything CLAUDE.md records the founder asked for is
kept as it is: the feed and how one clip plays, the plus and the board,
the tile system, the mark, the paper, the sport tints, the depth, the
log's two screens, Mark it up, Starred, the walkthrough's seven steps.
A large item *adds* — a new screen, a new control beside an existing
one, a new route — and never re-lays out a screen that is approved. If
the only way to build an item is to change something protected, it is
not this run's item; write it under "Found, not fixed" with the reason.

## Time (from the session's start)

| By      | State                                                    |
|---------|----------------------------------------------------------|
| 0:45    | Research done, the brief updated, the large item chosen  |
| 3:30    | The large item built and its own suite passing           |
| 4:00    | No further code changes                                  |
| 4:30    | Every pull request merged, main green                    |
| 4:45    | Summary file merged                                      |
| 4:50    | Nothing in flight                                        |

A piece of work that cannot make these is left out and written down.
Stability and a clean main beat feature count — but a run that ends
with only a small fix says so plainly in its summary and why.

## Phases

1. **Research (45 minutes, all of it used).** In this order:
   - Inward: the previous summary, `docs/research/*.md` (the standing
     brief of large items, ranked, each with its case), `git log
     --oneline -40`, open pull requests and issues, CLAUDE.md's rules
     (the protected list is there), and a screenshot sweep of the
     current build (`polish-shots.cjs`) read by eye.
   - Outward, with web search: what the reference products do — V1
     Golf / V1 Coach, OnForm, CoachNow, Skillest, Sportsbox AI, Hudl,
     TennisLocker, CoachIQ, TeamSnap, Dartfish, Coach's Eye — and what
     a coach in golf, tennis, rowing, squash, padel or equestrian
     would expect of an app like this. New findings go into the brief
     with their sources; an item already built is struck off.
   - Then choose. The top item of the brief that is not protected-
     conflicting and fits the window is the run's large item. Write
     its case in three lines at the top of the summary before any
     code: what it is, who notices it, what it must not touch.
2. **Implementation.** Branch `claude/daily-YYYY-MM-DD` from
   `origin/main` — or, when the cycle runs inside a standing session
   that was given a branch, that branch, restarted from `origin/main`;
   small atomic commits; the architecture in CLAUDE.md. The large item
   gets its own e2e suite under `scripts/e2e/` (or new sections in the
   suite that owns its surface), a CLAUDE.md bullet in the founder's
   register (what it is, what it replaced, what was tried and why), and
   a row in `scripts/e2e/README.md`.
   No test is disabled, skipped or weakened. No force-push, no history
   rewriting, no direct changes to the live Supabase project or
   Netlify. No model names in commits, pull requests or code. A change
   to `supabase/nosca.sql` is allowed when the item needs it, but the
   app must work before the founder re-runs the file (a new column
   degrades to the device, the way `preferences.starred` did).
3. **Quality assurance.** `npm run check`, `npm run build`,
   `supabase/test/run.sh` when nosca.sql changed, a mock build, every
   suite under `scripts/e2e` against it (at most two Playwright jobs at
   once), the seed sweep, the dead-ends crawl, the walkthrough
   alignment, and the screenshot sweep, read by eye against the
   previous run's.

   **Long jobs run detached from the tool.** The tool stops a
   background job at ten minutes, which has killed the dead-ends crawl
   (about forty minutes) and the suite chain part-way. Start them with
   `setsid nohup … > log 2>&1 & disown` from the first minute, and poll
   their logs with waits of at most 570 seconds, re-armed.

## Publishing

Push the branch, open a pull request that says what changed, who will
notice it and where, and how it was verified; merge it (merge commit)
once the deploy preview is green. Then write the summary file, push,
open a second small pull request and merge it. If the GitHub tools are
missing from the session, merge locally:
`git fetch origin main && git checkout -B main origin/main &&
git merge --no-ff claude/daily-YYYY-MM-DD && git push origin main`.

## When something fails

A red check or build, a failing suite, a blocked merge or push, or a
dead end the crawl finds that cannot be fixed inside the window: send
the founder a push notification naming the step and the reason (the
`PushNotification` tool), write it under "Found, not fixed" in the
summary, and leave main clean. A failure is never quietly dropped.

## The summary file

```
# YYYY-MM-DD

Elapsed: Xh Ym of 5h.

## The large item
- what it is, in one line; who notices it and where (the screen, the
  tap that reaches it); what it did not touch; the pull request number

## Also done
- the small fix, if any, in one line with its pull request number

## Research
- what was read and searched, in a few lines; what went into the brief

## Verified
- check, build, SQL suite (if run), each e2e suite with its count,
  seed sweep, dead ends, walkthrough, screenshots read

## Found, not fixed
- each with where it is and what was seen

## Next
- the brief's remaining large items in order, then the small fixes
```
