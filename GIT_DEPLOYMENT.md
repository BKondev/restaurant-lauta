# Git-based Deployment (GitHub → Server pull)

This replaces SCP-based deploys with a reliable workflow:

1) commit + push to GitHub
2) server pulls latest code and restarts

## One-time local setup

```powershell
cd C:\Users\User\Desktop\resturant-template

git config user.name "<YOUR_NAME>"
git config user.email "<YOUR_EMAIL>"
```

Create a GitHub repo, then set the remote:

```powershell
git remote add origin <YOUR_GITHUB_REPO_URL>
```

## One-time server setup (recommended)

If the GitHub repo is private, set up a deploy key on the server:

```bash
ssh root@46.62.174.218

# create a dedicated deploy key
ssh-keygen -t ed25519 -C "deploy@crystalautomation" -f /root/.ssh/github_deploy_key

eval "$(ssh-agent -s)"
ssh-add /root/.ssh/github_deploy_key

cat /root/.ssh/github_deploy_key.pub
```

Add the public key as a **Deploy key** in GitHub (read-only is enough).

Optional: add an ssh config entry:

```bash
cat >> /root/.ssh/config <<'EOF'
Host github.com
  IdentityFile /root/.ssh/github_deploy_key
  IdentitiesOnly yes
EOF
chmod 600 /root/.ssh/config
```

## Deploy (normal day-to-day)

Run:

```powershell
cd C:\Users\User\Desktop\resturant-template
.\deploy-git.ps1 -RepoUrl "<YOUR_GITHUB_REPO_URL>" -CommitMessage "deploy"
```

What it does:
- `git add -A` + commit (if needed) + push
- SSH to the server, `git fetch` + `reset --hard` to the remote branch
- `npm ci --omit=dev` (or `npm install --omit=dev`)
- restart PM2 process `restaurant-backend`

## Important notes

- `database.json` is intentionally ignored (see `.gitignore`). Production data stays on the server.
- If you ever need to deploy a fixed production database, do it explicitly (not via git).
