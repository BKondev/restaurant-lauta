# Deploy to all instances (3-6 platforms on one server)

Use this when you have multiple copies of the platform running on the same server (different folders / different BASE_PATH / different PM2 names) and you want one deploy command to update them all.

## Script

- Windows PowerShell: [deploy-git-all.ps1](deploy-git-all.ps1)

## Default behavior

- Commits and pushes your local changes to `origin/main`.
- SSHes to the server.
- Auto-discovers instance folders under `/opt` matching `resturant-website*`.
- For each folder:
  - Preserves production-only files (`database.json`, `.env`, `uploads/`) in `.preserve/`
  - `git fetch` + `reset --hard` to the latest commit
  - installs deps: `npm ci --omit=dev` (or `npm install --omit=dev`)
  - restarts PM2

## Usage

### 1) Deploy to all auto-discovered instances

```powershell
.\deploy-git-all.ps1 -CommitMessage "deploy"
```

### 2) Deploy to an explicit list of instances

```powershell
.\deploy-git-all.ps1 -DeployDirs @(
  "/opt/resturant-website",
  "/opt/resturant-website-tenant2",
  "/opt/resturant-website-tenant3"
) -CommitMessage "deploy"
```

### 3) PM2 process naming

The remote script chooses the PM2 process name per folder:

1) If the instance has `.env` and defines one of:

- `PM2_NAME=...`
- `PM2_PROCESS=...`
- `PM2_APP_NAME=...`

…it will use that.

2) Otherwise:

- `/opt/resturant-website` uses `restaurant-backend` (default)
- other folders use `restaurant-backend-<foldername>`

So for predictable restarts, it’s best to add `PM2_NAME` into each instance’s `.env`.

## Return URLs / BASE_PATH

This script does not change `.env` or nginx; it only updates code and restarts services.
Each instance must already have the correct `BASE_PATH` and domain config.
