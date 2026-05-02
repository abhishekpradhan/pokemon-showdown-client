# Fork Governance

This fork is developed at `https://github.com/abhishekpradhan/pokemon-showdown-client`.

## Repository Setup

- `origin`: `https://github.com/abhishekpradhan/pokemon-showdown-client.git`
- `upstream`: `https://github.com/smogon/pokemon-showdown-client.git`
- Production branch: `main`
- Upstream tracking branch: `upstream/master`

## Branch Protection

Configure `main` in GitHub with:

- Require pull requests before merging
- Require CI to pass
- Require Vercel preview deployment checks
- Disable direct pushes
- Require linear history if the team wants simpler upstream cherry-picks

## Upstream Policy

Track upstream selectively. Prioritize:

- Security fixes
- Protocol changes
- Battle data and replay compatibility
- Login, storage, and team format changes

Avoid merging upstream UI rewrites wholesale after the modern client diverges.

## Vercel

Vercel hosts the frontend only. Realtime battle and chat traffic should connect
from the browser to the PS-compatible server directly. Add Vercel Functions only
for deliberate proxy or fork-specific helper APIs, not the critical battle loop.
