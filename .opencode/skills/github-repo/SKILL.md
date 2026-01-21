---
name: github-repo
description: Manage GitHub repositories - create, upload projects, make commits, push updates, and handle merge operations. Use when initializing a new GitHub repository, uploading project files, committing changes, pushing to remote, creating pull requests, or merging branches.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# GitHub Repository Management Workflow

This skill automates the complete workflow for managing GitHub repositories, including initial setup, file uploads, commits, pushes, and merge operations.

## Prerequisites

Before using this skill, you need:
1. A GitHub account
2. A GitHub personal access token (classic) with appropriate permissions:
   - `repo` - for private repository operations
   - `admin:repo_hook` - for webhook configuration (if needed)

## Workflow Steps

### Step 1: Collect Required Information

Ask the user for:
- GitHub username (e.g., `username`)
- Repository name (e.g., `my-project`)
- Repository visibility: public or private
- GitHub personal access token (classic)
- Remote repository URL if it already exists

### Step 2: Setup Environment Variables

Create a `.env` file for sensitive credentials (NEVER commit this):
```
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

### Step 3: Create .gitignore

Create `.gitignore` if not exists. Use appropriate template based on project type:

**For Node.js/TypeScript projects:**
```
# Dependencies
node_modules/

# Build output
dist/
build/
*.local

# Environment variables
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Editor directories
.vscode/
!.vscode/extensions.json
.idea/
.DS_Store
*.suo
*.sw?
```

**For Python projects:**
```
__pycache__/
*.py[cod]
*.pyo
*.pyd
.Python
venv/
env/
.venv/
*.egg-info/
dist/
build/
.env
```

**For general projects:**
```
node_modules/
.env
.DS_Store
*.log
dist/
build/
.idea/
.vscode/
```

### Step 4: Initialize Git Repository

```bash
git init
git config user.email "user@example.com"
git config user.name "Username"
```

### Step 5: Create GitHub Repository

**Option A: Repository already exists**
```bash
git remote add origin "https://$TOKEN@github.com/USERNAME/REPO_NAME.git"
```

**Option B: Create new repository via GitHub API**
```bash
TOKEN=$(grep GITHUB_TOKEN .env | cut -d '=' -f2)

curl -H "Authorization: token $TOKEN" \
     -d '{"name":"REPO_NAME", "private":true, "auto_init":true}' \
     https://api.github.com/user/repos
```

### Step 6: Add and Commit Files

```bash
# Stage all files
git add .

# Create initial commit
git commit -m "Initial commit"

# OR for updates:
git commit -m "Describe your changes"
```

### Step 7: Push to GitHub

```bash
TOKEN=$(grep GITHUB_TOKEN .env | cut -d '=' -f2)
git remote set-url origin "https://$TOKEN@github.com/USERNAME/REPO_NAME.git"
git push -u origin main
```

### Step 8: Making Updates and Merges

**Making a commit and push:**
```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "Brief description of changes"

# Push to remote
git push origin main
```

**Creating a pull request:**
```bash
TOKEN=$(grep GITHUB_TOKEN .env | cut -d '=' -f2)

curl -H "Authorization: token $TOKEN" \
     -d '{"title":"PR Title", "body":"PR description", "head":"feature-branch", "base":"main"}' \
     https://api.github.com/repos/USERNAME/REPO_NAME/pulls
```

**Merging a pull request:**
```bash
TOKEN=$(grep GITHUB_TOKEN .env | cut -d '=' -f2)

curl -X PUT \
     -H "Authorization: token $TOKEN" \
     https://api.github.com/repos/USERNAME/REPO_NAME/pulls/PULL_NUMBER/merge \
     -d '{"merge_method":"squash"}'
```

## Common Workflows

### Workflow 1: Initial Project Upload
1. Collect GitHub username, repo name, and token
2. Create `.env` with GITHUB_TOKEN
3. Run `git init` and configure user
4. Create GitHub repo via API (or use existing)
5. Add all project files
6. Commit with "Initial commit"
7. Push to remote

### Workflow 2: Regular Code Updates
1. Make code changes
2. Run `git add .` to stage
3. Run `git commit -m "message"` with descriptive commit message
4. Run `git push origin main` to push changes

### Workflow 3: Feature Branch Workflow
1. Create feature branch: `git checkout -b feature-name`
2. Make changes and commit
3. Push branch: `git push origin feature-name`
4. Create PR via GitHub API
5. After review, merge PR

## Verification Checklist

After operations, verify:
- [ ] `.env` file exists with valid token (NOT committed)
- [ ] `.gitignore` includes `.env`
- [ ] GitHub repository is created and accessible
- [ ] All files are pushed to remote
- [ ] Commit messages are descriptive

## Troubleshooting

**"remote origin already exists":**
```bash
git remote remove origin
git remote add origin "https://$TOKEN@github.com/USERNAME/REPO_NAME.git"
```

**"permission denied":**
- Verify token has correct permissions
- Check if repository is private and token has access

**"nothing to commit":**
- Check git status: `git status`
- Make file changes before committing

**"branch has diverged":**
```bash
git fetch origin
git rebase origin/main
git push origin main --force  # Use with caution
```

## Related Resources

- [GitHub REST API](https://docs.github.com/en/rest)
- [GitHub Personal Access Tokens](https://github.com/settings/tokens)
- [Git Commit Messages](https://chris.beams.io/posts/git-commit/)
