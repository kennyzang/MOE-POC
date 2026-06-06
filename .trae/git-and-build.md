# 🔧 Git & Build Rules

## 📦 Dependency Management

### ✅ DO: Use `npm ci` for Consistency
```bash
# Install dependencies (strict, matches lock file)
npm ci          # ✅ Production-grade, reproducible
```

### ❌ DON'T: Use `npm install` Casually
```bash
npm install     # ⚠️ May update lock file, install different versions
```

**Note**: PC `.npmrc` has `save-exact=true`, so new deps auto-pin exact versions.

---

## 🏗️ Build Verification (MANDATORY Before Every Commit)

### Required Commands
```bash
# Build PC frontend
cd pc && npm run build

# Build Mobile frontend
cd mobile && npm run build

# Both must pass with 0 errors before committing
```

### What Gets Checked
- TypeScript compilation errors
- Import/export issues
- Missing type definitions
- CSS module resolution
- Bundle size warnings

---

## 🚫 Git Ignore Rules

**Never commit these files**:
```
.env                # Environment variables (contains secrets)
*.key               # Private keys
*.pem               # Certificates
*.mp4               # Video files (large)
node_modules/       # Dependencies
*.db                # SQLite databases
screenshots/        # Playwright test screenshots
.playwright-mcp/    # Playwright MCP cache
.DS_Store           # macOS system files
```

Check `.gitignore` for complete list.

---

## 🌐 Dual Remote Repository Strategy

### Repository Configuration
```bash
# View current remotes
git remote -v

# Expected output:
# origin   git.landray.com.cn/.../moe-poc.git (push/fetch)
# github   github.com/kennyzang/MOE-POC.git (push/fetch)
```

### Push Workflow

#### Normal Situation (Both Available)
```bash
git push github master      # Push to GitHub (public)
git push origin master      # Push to Landray (internal VPN)
```

#### Network Restricted (No VPN)
```bash
# Step 1: Push to GitHub only
git push github master

# Step 2: When back at office (with VPN)
git push origin master
```

#### Sync Both Repositories
```bash
# Ensure both remotes are in sync
git fetch --all
git log --oneline origin/master..github/master  # GitHub ahead?
git log --oneline github/master..origin.master  # Origin ahead?
```

---

## 🔒 Security Rules (CRITICAL)

### ❌ NEVER Commit Secrets

**Forbidden patterns in code**:
```typescript
// ❌ Hardcoded passwords
const password = 'SuperSecret123'
const apiKey = 'sk-abc123def456'
const jwtSecret = 'my-secret-key'

// ❌ Connection strings with credentials
const dbUrl = 'postgres://user:password@host:5432/db'
const smtpConfig = { user: 'admin@school.edu', pass: 'email123' }
```

### ✅ Correct Approach

**1. Use environment variables**:
```typescript
// .env (gitignored)
DATABASE_URL="file:./dev.db"
JWT_SECRET=your-production-secret-here
SMTP_PASS=<placeholder>

// Code reads from process.env
const dbUrl = process.env.DATABASE_URL!
const jwtSecret = process.env.JWT_SECRET!
```

**2. Use database config table**:
```typescript
// Store runtime config in DB SystemConfig table
await prisma.systemConfig.upsert({
  where: { key: 'smtp_password' },
  update: { value: encryptedPassword },
  create: { key: 'smtp_password', value: encryptedPassword },
})
```

**3. Documentation examples use placeholders**:
```markdown
# ✅ Good documentation
SMTP_PASS=<your-smtp-password>
API_KEY=<your-api-key>

# ❌ Bad documentation (reveals actual values)
SMTP_PASS=XyZ123abc
API_KEY=sk-live-abcdef123456
```

### 🔍 Pre-Commit Secret Scan

Run this before every commit:
```bash
git diff --cached | grep -iE "(password|secret|api.?key|token|auth)\s*[=:]\s*\S{8,}"
```

**If output appears**: STOP! Remove secrets or move to `.env`.

---

## 🆘 Security Incident Response

If secrets are accidentally committed:

1. **Immediately rotate** the compromised credential
2. **Rewrite Git history**:
   ```bash
   git filter-branch --force --tree-filter '
     rm -f .env \
     && find . -name "*.env*" -not -name ".env.example" -delete
   ' HEAD~10..HEAD
   ```
3. **Force push** to overwrite remote history:
   ```bash
   git push --force-with-lease origin master
   git push --force-with-lease github master
   ```
4. **Notify** affected service providers
5. **Document** incident in dev-log

---

## 📸 Screenshot Rules

- **Location**: Save Playwright screenshots to `screenshots/` (project root)
- **Git status**: Directory is in `.gitignore`, never committed
- **Prohibited**: Don't save screenshots directly in source directories

---

## 🔄 Pre-Push Hook (Recommended)

Add to `.git/hooks/pre-push`:
```bash
#!/bin/bash
set -e

echo "🔍 Running pre-push checks..."

# Check for secrets
if git diff --cached | grep -qiE "(password|secret|api.?key|token)\s*[=:]\s*\S{8,}"; then
  echo "❌ Potential secret detected! Aborting push."
  exit 1
fi

# Run builds
if ! cd pc && npm run build; then
  echo "❌ PC build failed! Fix errors before pushing."
  exit 1
fi

if ! cd ../mobile && npm run build; then
  echo "❌ Mobile build failed! Fix errors before pushing."
  exit 1
fi

echo "✅ All checks passed! Proceeding with push..."
```

Make executable: `chmod +x .git/hooks/pre-push`

---

## 📋 Quick Reference Card

| Action | Command | When |
|--------|---------|------|
| Install deps | `npm ci` | First time / CI |
| Build check | `cd pc && npm run build` | Before commit |
| Push public | `git push github master` | Always first |
| Push internal | `git push origin master` | When VPN available |
| Scan secrets | See pattern above | Before commit |
| Rotate creds | Change immediately | If leaked |

---

**For Trae AI**: Enforce security rules strictly. Never generate code with hardcoded secrets. Always suggest environment variable usage.
