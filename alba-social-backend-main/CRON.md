# Scheduled notifications (Railway cron)

Scheduled notification jobs run as **one-shot processes** via a standalone Nest
entrypoint. Railway runs the command on a cron schedule; the process does its
work and exits. No always-on scheduler lives inside the API server.

## How it fits together

| Piece | File |
| --- | --- |
| Job logic (the registry of jobs) | [`src/cron/scheduled-notifications.service.ts`](src/cron/scheduled-notifications.service.ts) |
| Minimal module booted by the runner | [`src/cron/cron.module.ts`](src/cron/cron.module.ts) |
| Standalone entrypoint | [`src/cron/scheduled-notifications.runner.ts`](src/cron/scheduled-notifications.runner.ts) |

## Available jobs

| Job name | What it does | Schedule |
| --- | --- | --- |
| `games-nearby-weekly` | Notifies located users about open games within 10km in the next week. Notifies a given user at most once every two days. | Daily |
| `unpaid-game-reminder` | "Last call" reminder to approved players who still owe for a game happening in the next 24 hours. Dedupes per game+player over 24h. | Daily |
| `playing-tomorrow` | "Playing tomorrow" tee-time reminder to approved players of a ready game happening in the next 24 hours. Dedupes per game+player over 24h. | Daily |
| `under-capacity-nudge` | Nudges the organiser of a game happening in the next 24 hours that still has fewer players than it needs, suggesting they drop to a smaller ball. Dedupes per game over 24h. | Daily |
| `payout-on-its-way` | Tells the organiser their payout is coming, the day after a completed round (round was 1–2 days ago). Dedupes per game over the last week. | Daily |

These jobs run on the same daily cadence but each as a **separate Railway cron
service** (one service per job — see below).

The runner boots the DI container with `NestFactory.createApplicationContext`
(no HTTP server), resolves `ScheduledNotificationsService`, runs the named job,
flushes Sentry, and exits `0` (success) or `1` (failure).

A **job name is required** — each cron service runs exactly one named job on its
own schedule. Running the runner without a name exits non-zero without doing
anything, so a misconfigured service fails loudly.

## Running locally

```bash
npm run build
npm run cron:notifications games-nearby-weekly
# or: CRON_JOB=games-nearby-weekly npm run cron:notifications
```

## Setting up the Railway cron service

Railway crons are configured **per service**, and a cron service should run a
command that exits when finished.

1. In your Railway project, create a **new service from this same repo** (so it
   builds the same Docker image as the API). Give it a clear name, e.g.
   `cron-notifications`.
2. Give it the environment variables the cron actually needs:
   - **`DATABASE_URL`** (required).
   - **`SENTRY_DSN`** + **`NODE_ENV=production`** (optional, recommended for
     error visibility).

   The cron does **not** need the `FIREBASE_*` vars — it's decoupled from
   Firebase (it never authenticates requests), so leave them off this service.
3. Set the service's **Custom Start Command** to run a specific job, e.g.:
   ```
   node dist/cron/scheduled-notifications.runner.js games-nearby-weekly
   ```
   (Or omit the arg and set a `CRON_JOB` variable instead.)
4. In the service settings, set the **Cron Schedule** (standard cron syntax,
   UTC). The "games near you" job runs daily, e.g. `0 9 * * *` for every day at
   09:00 UTC. The job itself only notifies a user once every two days.

Railway will then run the start command on that schedule and the process will
exit when the job completes. Use one service per job/schedule.

> Note: a cron service should not also expose an HTTP port — this runner doesn't
> listen, so Railway will treat each run as a finite job.

## Available jobs

| Job name | What it does |
| --- | --- |
| `games-nearby-weekly` | Notifies each user about new games this week whose course is within 10km of them (games they didn't create or join). At most one notification per user per week. One match: "New game at {course}"; multiple: "{n} new games near you this week". Run it weekly. |

## Adding a new scheduled job

1. Add a private `async myJob()` method to `ScheduledNotificationsService`.
   Query the audience and call `this.notificationsService.sendNotificationToUser`
   (or `sendNotificationToAll`) — these already respect each user's notification
   settings, persist the notification row, and record delivery.
2. Register it in the `jobs` map with a kebab-case name.
3. Create a Railway cron service whose start command passes that job name, with
   the schedule you want.
