# Docker Deployment Guide

Run your own prompts.chat instance using Docker Compose.

[`compose.yml`](/compose.yml) supports both the pre-built container image being fetched from ghcr.io, or being built locally.

## Quick Start

### To build locally

Local builds run the full Next.js production build inside Docker. Allocate at least 4 GB of memory to Docker Desktop or your Docker daemon before running the build. If the build exits with code 137, Docker likely ran out of memory; increase the memory limit or use the pre-built image below.

```bash
git clone https://github.com/f/prompts.chat.git
cd prompts.chat
docker compose up -d --build
```

Open http://localhost:4444 in your browser.

### Using a Pre-built Image

Simply remove the `--build` flag from the command:

```bash
git clone https://github.com/f/prompts.chat.git
cd prompts.chat
docker compose up -d
```

## Standalone (Bring Your Own Database)

If you already have a PostgreSQL instance, you can run just the app container:

Need a hosted PostgreSQL database? We recommend [Neon](https://get.neon.com/VqfnMo4) for serverless Postgres with connection pooling and database branching.

<div>
  <p>Sponsored by</p>
  <a href="https://get.neon.com/VqfnMo4">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/neon-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/neon.svg">
      <img width="250px" alt="Neon Logo fallback" src="https://raw.githubusercontent.com/f/prompts.chat/main/public/sponsors/neon-dark.svg">
    </picture>
  </a>
</div>

```bash
docker build -f docker/Dockerfile -t prompts.chat .
docker run -d \
  --name prompts \
  -p 4444:3000 \
  -e DATABASE_URL="postgresql://user:pass@your-db-host:5432/prompts?schema=public" \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  prompts.chat
```

Or if you simply want to use the pre-built image:

```bash
docker run -d \
  --name prompts \
  -p 4444:3000 \
  -e DATABASE_URL="postgresql://user:pass@your-db-host:5432/prompts?schema=public" \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  ghcr.io/f/prompts.chat:latest
```

## Custom Branding

All branding is configured via `PCHAT_*` environment variables at runtime -- no rebuild needed.

```yaml
# compose.yml
services:
  app:
    environment:
      # ... existing vars ...
      PCHAT_NAME: "Acme Prompts"
      PCHAT_DESCRIPTION: "Our team's AI prompt library"
      PCHAT_COLOR: "#ff6600"
      PCHAT_AUTH_PROVIDERS: "github,google"
      PCHAT_LOCALES: "en,es,fr"
```

Then restart: `docker compose up -d`

## Configuration Variables

All variables are prefixed with `PCHAT_` to avoid conflicts.

#### Branding (`branding.*` in prompts.config.ts)

| Env Variable | Config Path | Description | Default |
|--------------|-------------|-------------|---------|
| `PCHAT_NAME` | `branding.name` | App name shown in UI | `My Prompt Library` |
| `PCHAT_DESCRIPTION` | `branding.description` | App description | `Collect, organize...` |
| `PCHAT_LOGO` | `branding.logo` | Logo path (in public/) | `/logo.svg` |
| `PCHAT_LOGO_DARK` | `branding.logoDark` | Dark mode logo | Same as `PCHAT_LOGO` |
| `PCHAT_FAVICON` | `branding.favicon` | Favicon path | `/logo.svg` |

#### Theme (`theme.*` in prompts.config.ts)

| Env Variable | Config Path | Description | Default |
|--------------|-------------|-------------|---------|
| `PCHAT_COLOR` | `theme.colors.primary` | Primary color (hex) | `#6366f1` |
| `PCHAT_THEME_RADIUS` | `theme.radius` | Border radius: `none\|sm\|md\|lg` | `sm` |
| `PCHAT_THEME_VARIANT` | `theme.variant` | UI style: `default\|flat\|brutal` | `default` |
| `PCHAT_THEME_DENSITY` | `theme.density` | Spacing: `compact\|default\|comfortable` | `default` |

#### Authentication (`auth.*` in prompts.config.ts)

| Env Variable | Config Path | Description | Default |
|--------------|-------------|-------------|---------|
| `PCHAT_AUTH_PROVIDERS` | `auth.providers` | Providers: `github,google,credentials` | `credentials` |
| `PCHAT_ALLOW_REGISTRATION` | `auth.allowRegistration` | Allow public signup | `true` |

#### Internationalization (`i18n.*` in prompts.config.ts)

| Env Variable | Config Path | Description | Default |
|--------------|-------------|-------------|---------|
| `PCHAT_LOCALES` | `i18n.locales` | Supported locales (comma-separated) | `en` |
| `PCHAT_DEFAULT_LOCALE` | `i18n.defaultLocale` | Default locale | `en` |

#### Features (`features.*` in prompts.config.ts)

| Env Variable | Config Path | Description | Default |
|--------------|-------------|-------------|---------|
| `PCHAT_FEATURE_PRIVATE_PROMPTS` | `features.privatePrompts` | Enable private prompts | `true` |
| `PCHAT_FEATURE_CHANGE_REQUESTS` | `features.changeRequests` | Enable versioning | `true` |
| `PCHAT_FEATURE_CATEGORIES` | `features.categories` | Enable categories | `true` |
| `PCHAT_FEATURE_TAGS` | `features.tags` | Enable tags | `true` |
| `PCHAT_FEATURE_COMMENTS` | `features.comments` | Enable comments | `true` |
| `PCHAT_FEATURE_AI_SEARCH` | `features.aiSearch` | Enable AI search | `false` |
| `PCHAT_FEATURE_AI_GENERATION` | `features.aiGeneration` | Enable AI generation | `false` |
| `PCHAT_FEATURE_MCP` | `features.mcp` | Enable MCP features | `false` |

## System Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTH_SECRET` | Secret for authentication tokens | Auto-generated (set explicitly for production) |
| `DATABASE_URL` | PostgreSQL connection string | Set in compose.yml |
| `DIRECT_URL` | Direct PostgreSQL URL (bypasses poolers) | Same as DATABASE_URL |
| `PORT` | Host port mapping | `4444` |

## Production Setup

For production, always set `AUTH_SECRET` explicitly:

```bash
# Generate a secret
export AUTH_SECRET=$(openssl rand -base64 32)

# Start with explicit secret
docker compose up -d
```

Or add it to a `.env` file next to `compose.yml`:

```env
AUTH_SECRET=your-secret-key-here
```

### With OAuth Providers

```yaml
# compose.yml
services:
  app:
    environment:
      # ... existing vars ...
      PCHAT_AUTH_PROVIDERS: "github,google"
      AUTH_GITHUB_ID: "your-github-client-id"
      AUTH_GITHUB_SECRET: "your-github-client-secret"
      AUTH_GOOGLE_ID: "your-google-client-id"
      AUTH_GOOGLE_SECRET: "your-google-client-secret"
```

### With AI Features (OpenAI)

```yaml
# compose.yml
services:
  app:
    environment:
      # ... existing vars ...
      PCHAT_FEATURE_AI_SEARCH: "true"
      OPENAI_API_KEY: "sk-..."
```

## Database Seeding

Seed the database with example prompts:

```bash
docker compose exec app npx prisma db seed
```

## Custom Logo

Mount your logo file into the app container:

```yaml
# compose.yml
services:
  app:
    volumes:
      - ./my-logo.svg:/app/public/logo.svg
    environment:
      PCHAT_LOGO: "/logo.svg"
```

## Data Persistence

PostgreSQL data is stored in the `postgres_data` named volume and persists across container restarts, rebuilds, and image updates.

### Backup

```bash
# Backup database
docker compose exec db pg_dump -U prompts prompts > backup.sql

# Restore database
docker compose exec -T db psql -U prompts prompts < backup.sql
```

## Building Locally

```bash
docker compose build
docker compose up -d
```

## Health Check

The app container includes a health check endpoint:

```bash
curl http://localhost:4444/api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": "connected"
}
```

## Troubleshooting

### View Logs

```bash
# All services
docker compose logs

# Follow logs
docker compose logs -f

# App logs only
docker compose logs app

# Database logs only
docker compose logs db
```

### Database Access

```bash
# Connect to PostgreSQL
docker compose exec db psql -U prompts -d prompts

# Run a query
docker compose exec db psql -U prompts -d prompts -c "SELECT COUNT(*) FROM \"Prompt\""
```

### Container Shell

```bash
docker compose exec app sh
docker compose exec db bash
```

### Common Issues

**App container keeps restarting:**
- Check logs: `docker compose logs app`
- Database may not be ready yet -- the entrypoint retries for up to 60 seconds

**Database connection errors:**
- Verify the `db` service is healthy: `docker compose ps`
- Check database logs: `docker compose logs db`

**Authentication issues:**
- Set `AUTH_SECRET` explicitly for production
- For OAuth, verify callback URLs match your domain

## Updating

```bash
# If using pre-built images
docker compose pull
docker compose up -d

# If building locally
git pull
docker compose build
docker compose up -d
```

Data persists in the `postgres_data` volume across updates.

## Migrating from the Old Single-Image Setup

If you were using the previous all-in-one Docker image:

```bash
# 1. Export your database from the old container
docker exec prompts pg_dump -U prompts prompts > backup.sql

# 2. Stop and remove the old container
docker stop prompts && docker rm prompts

# 3. Start the new compose setup
docker compose up -d

# 4. Import your data
docker compose exec -T db psql -U prompts prompts < backup.sql
```

## Resource Requirements

**Runtime** (after first build):
- 1 CPU core
- 1GB RAM
- 2GB disk space

**First-run build** (Next.js compilation on startup):
- 1 CPU core
- Higher memory required (OOM may occur with low limits)
- 2GB disk space

> ⚠️ If you see `Killed` followed by `exited with code 137` during first startup,
> your Docker container likely ran out of memory during the build step.
> Increasing Docker's memory allocation (e.g., ~4GB or more) can help resolve this.
> On Docker Desktop: Settings → Resources → Memory.

**Recommended for production:**
- 2 CPU cores
- 2GB RAM (runtime)
- 10GB disk space

## Running Behind a Reverse Proxy

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name prompts.example.com;

    ssl_certificate /etc/letsencrypt/live/prompts.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/prompts.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:4444;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Caddy

```caddyfile
prompts.example.com {
    reverse_proxy localhost:4444
}
```

## Security Considerations

1. **Always set AUTH_SECRET** in production
2. **Use HTTPS** -- put a reverse proxy (Nginx, Caddy, Traefik) in front
3. **Change default database password** -- update `POSTGRES_PASSWORD` in compose.yml and the connection strings
4. **Limit exposed ports** -- only expose what's needed
5. **Regular updates** -- pull the latest image regularly
6. **Backup data** -- regularly backup the database

## License

MIT
