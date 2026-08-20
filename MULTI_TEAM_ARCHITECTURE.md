# Multi-Team Architecture

This application supports isolated team workspaces.

- Public team URL: `/team/<team-slug>`
- Captain URL: `/captain/<team-slug>`
- Legacy `/team` and `/captain` resolve to the founder Bunt Cakes workspace.
- Captain authentication is user-level; membership authorizes access to a specific team.
- Each team has an independent state row, branding, roster, schedule, availability, push subscriptions, resources, and settings.
- New team workspaces start with a blank state and onboarding opens Team Settings.
- The legacy `team_state` table remains untouched during migration for rollback safety.
