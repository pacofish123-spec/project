# One-time setup for the nightly backup workflow

`backup.yml` in this folder runs a full `pg_dump` of the Supabase
database every night, encrypts it, and pushes it to a *separate
private* repo. It needs four secrets set on **this** repo
(`pacofish123-spec/project` — Settings → Secrets and variables →
Actions → New repository secret) before it can run. None of this
touches this repo's own code or its public visibility.

## 1. Create the private backups repo

On GitHub: New repository → any name (e.g. `yorento-backups`) →
**Private**. Leave it empty (no README needed).

## 2. Generate an encryption passphrase

Run this once, locally:

```bash
openssl rand -base64 32
```

Save the output somewhere durable **outside GitHub** — a password
manager, not a note in this repo. Anyone who gets a dump file *and*
this passphrase can read everything in it (payment records, identity
verification data, messages); anyone who gets only the file gets
nothing. If this passphrase is ever lost, every existing backup
becomes permanently unreadable — there is no recovery path.

Add it as secret **`BACKUP_ENCRYPTION_KEY`**.

## 3. Create a token scoped to only the backups repo

GitHub → Settings (your account, not the repo) → Developer settings →
Personal access tokens → **Fine-grained tokens** → Generate new token.

- Repository access: **Only select repositories** → the private repo
  from step 1. Not this repo, not "all repositories."
- Permissions: **Contents: Read and write**. Nothing else.

Add it as secret **`BACKUP_REPO_TOKEN`**.

## 4. Point the workflow at the backups repo

Add secret **`BACKUP_REPO`** with the value `yourname/yorento-backups`
(whatever you named it in step 1).

## 5. Get the database connection string

Supabase dashboard → this project → Project Settings → Database →
Connection string → **URI** tab → the **Direct connection** one (not
"Transaction pooler" — `pg_dump` needs a real session, pooled
connections can reject it). It already contains the password; copy
the whole string as-is.

Add it as secret **`SUPABASE_DB_URL`**.

## 6. Test it

Actions tab → "Nightly database backup" → Run workflow (the
`workflow_dispatch` trigger). Confirm a `dumps/yorento-<timestamp>.dump.gpg`
file shows up in the private repo afterward. If it fails, the error
step names exactly which secret is missing.

Once that run succeeds, it repeats automatically every night at 09:00
UTC — no further action needed. Retention keeps the last 30 nightly
dumps in the private repo and prunes older ones.

---

## Restoring from a backup

```bash
# 1. Decrypt (needs the BACKUP_ENCRYPTION_KEY passphrase from step 2)
gpg --batch --yes --passphrase "<the passphrase>" \
  --decrypt yorento-2026-09-04T09-07-00Z.dump.gpg > backup.dump

# 2. Restore into a database (⚠️ this OVERWRITES matching data —
#    point --dbname at a scratch database first if you just want to
#    inspect the backup, not put it live)
pg_restore --no-owner --no-privileges --clean --if-exists \
  --dbname="<a postgres connection string>" backup.dump
```

`pg_restore` needs to be from a client version that's the same or
newer than the Postgres server's — if it's not already installed,
`brew install libpq && brew link --force libpq` on a Mac gets you a
current one.
