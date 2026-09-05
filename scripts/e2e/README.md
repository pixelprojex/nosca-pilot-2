# Rendering the app to prove it — the Playwright scripts

These drive the built app in headless Chromium against a mocked Supabase
(every request to the Supabase URL is answered in-process, shaped like
the real API after `supabase/nosca.sql`). They need no account, no
network and no credits. They are how every change in this repo was
verified before it was pushed.

Needs: Node 20+, Playwright (`npm i -g playwright` and
`npx playwright install chromium`, or set `PLAYWRIGHT_MODULE` to a
checkout's path and `CHROMIUM_PATH` to a Chromium binary).

Build once against the mock URL, then point a script at the build:

```sh
VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=mock \
  npx vite build --outDir /tmp/nosca-dist
node scripts/e2e/signup.cjs /tmp/nosca-dist 4181 /tmp/nosca-out/signup
```

| script | what it proves |
|---|---|
| `signup.cjs` | the whole sign-up and sign-in flow: coach / parent / adult / under-18, codes checked live, arrival with the real code, forgot password and the recovery link, deep links, check-your-inbox, existing email, join from the home screen |
| `auth-basics.cjs` | the earlier, smaller set (sign in, wrong password, session across reload, wrong code) |
| `delete-account.cjs` | Settings → Delete account → wrong password refused → right password: files removed by full path, `delete_my_account` called, signed out, landing |
| `seed-sweep.cjs` | signs in as each role (session injected) and crawls every screen it can tap into, failing on any seeded name, number, email or code |
| `core-loop.cjs` | lessons open by id with real media, download a lesson log, real chat (send, read, message everyone), attendance and live capture on today's bookings, the wizard's real voice note — 34 checks as coach, adult and under-18 |
| `diary.cjs` | booking requests and confirmations, drills and tips set outside the wizard, competitions, recurring lessons, weekly availability, personal details and password, invite routes, and the honesty pass — 61 checks (build with `VITE_SUPPORT_EMAIL` set) |
| `walkthrough-alignment.cjs` | opens `/?demo`, runs all four walkthroughs step by step and asserts each ring encloses its target; serve the build first: `npx vite preview --outDir /tmp/nosca-dist --port 4190` |

Every script takes `<absolute dist dir> <port> <absolute output dir>`
(except the walkthrough one, which reads a running server on its PORT)
and prints PASS/FAIL lines, screenshots to the output dir, and exits 0
so you can read the lines rather than parse an exit code.
