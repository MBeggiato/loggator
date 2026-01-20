# Development Setup for Loggator

## Local Development

For local development with hot-reload:

```bash
# 1. Start only the necessary services (Meilisearch + Test-Logger)
bun run dev:services

# 2. Start the dev server
bun run dev

# Or both in one command:
bun run dev:full
```

The app will run on: http://localhost:5173

### What's Running Where?

- **SvelteKit Dev Server**: `localhost:5173` (with hot-reload)
- **Meilisearch**: `localhost:7700` (Docker container)
- **Test-Logger**: Docker container with label `loggator.enable=true`
- **Docker Socket**: `/var/run/docker.sock` (locally available)

### Stop Services

```bash
bun run dev:stop
```

## Production Build

For production with all services in Docker:

```bash
docker compose down && docker compose up -d --build
```

The app will run on: http://localhost:3000

## Environment Variables

- **`.env.development`**: Automatically used for `bun run dev` (localhost)
- **`.env`**: Used for Docker containers (meilisearch:7700)
