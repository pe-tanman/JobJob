# JetJob

Free internship alerts for students. JetJob reads thousands of new postings a day,
classifies each one once with TypeSafe's Jev model, and emails each student the few
that fit. It learns from every Interested / Not for me answer.

## Run it locally

```bash
npm install
npm run ingest -- --boards=100   # fetch postings and classify them
npm run dev                      # http://localhost:3000
```

No accounts are needed for local development:

| Missing | Local fallback |
| --- | --- |
| `DATABASE_URL` | Embedded Postgres (PGlite) in `./.data` |
| `TYPESAFE_API_KEY` | Keyword stand-in for Jev (dev only, much less accurate) |
| `RESEND_API_KEY` | Emails written as HTML to `./.outbox`; sign-in links shown on screen |

Stop `next dev` before running `npm run ingest`, because PGlite allows one process at a time.
While the server is running, use `curl localhost:3000/api/cron/ingest` instead.

## How it works

```
Simplify list ─┬─▶ harvest ATS slugs ─▶ Greenhouse / Lever / Ashby boards
               ▼
      normalize ─▶ dedupe (company+title+location) ─▶ jobs
                                                       │
                     Jev pass A: 11 typed questions, once per posting, shared by all users
                                                       ▼
                                                  job_features
                                                       │
  per user: hard filters in SQL ─▶ rank with learned weights ─▶ Jev pass B (fit, top 40 only)
                                                       ▼
                                  matches ─▶ /matches feed and daily digest email
                                                       ▲
                          feedback ─▶ one SGD step on the user's logistic model (free)
```

- `src/ingest`: source adapters and the ingest run
- `src/jev`: question design (`questions.ts`), pass A (`classifyJob.ts`), pass B (`scoreFit.ts`)
- `src/rank`: features, per-user model, ranking with exploration, feedback
- `src/email`: digest and magic-link emails, and the digest runner
- `src/app`: pages, server actions, cron routes

## Cost

Jev costs $42 per billion input tokens, and output is free. Pass A runs once per posting,
not once per user. Pass B only runs on each user's shortlist. Learning is plain arithmetic.
Run `npm run eval:jev` with a key to measure real tokens per posting and accuracy on a
labeled sample.

## Tests

```bash
npm test                 # unit: normalize, dedupe, tokens, learning direction
npx playwright test      # e2e with the installed Chrome, including axe (light and dark)
npm run eval:jev         # Jev pass A accuracy, cost and latency on live data
```

## Deploy

Deploy to Vercel with the variables in `.env.example`. `vercel.json` schedules ingestion
every 6 hours and digests daily.
