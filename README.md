<p align="center">
  <img src="src/lib/assets/logo.png" alt="Loggator Logo" width="120" />
</p>

<h1 align="center">Loggator</h1>

<p align="center">
  <strong>Docker Log Aggregator powered by Meilisearch</strong><br>
  Collect, index, and search container logs with a modern web UI.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#api">API</a> •
  <a href="#development">Development</a>
</p>

---

## Quick Start

```yaml
# docker-compose.yml
services:
  loggator:
    image: ghcr.io/mbeggiato/loggator:latest
    ports:
      - '3000:3000'
    environment:
      - MEILISEARCH_HOST=http://meilisearch:7700
      - MEILISEARCH_API_KEY=your-secret-key
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    depends_on:
      - meilisearch

  meilisearch:
    image: getmeili/meilisearch:v1.6
    environment:
      - MEILI_MASTER_KEY=your-secret-key
    volumes:
      - meilisearch-data:/meili_data

volumes:
  meilisearch-data:
```

```bash
docker-compose up -d
# Open http://localhost:3000
```

### Enable logging for containers

Add label to containers you want to monitor:

```yaml
services:
  my-app:
    image: my-app
    labels:
      - 'loggator.enable=true'
```

## Features

- 🔍 **Full-text search** - Fast log search powered by Meilisearch
- 📊 **Real-time dashboard** - Live log streaming and statistics
- 🐳 **Label-based filtering** - Only monitor containers you choose
- 🌐 **Multi-language UI** - English and German support
- 🔔 **Update notifications** - Get notified of new releases
- 📈 **Log histograms** - Visualize log activity over time

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| \`MEILISEARCH_HOST\` | \`http://meilisearch:7700\` | Meilisearch URL |
| \`MEILISEARCH_API_KEY\` | - | Meilisearch API key |
| \`DOCKER_LABEL_FILTER\` | \`loggator.enable=true\` | Container filter label |
| \`PORT\` | \`3000\` | Web UI port |

## API

### Search logs
```bash
GET /api/logs/search?q=error&container=nginx&limit=50
```

### List containers
```bash
GET /api/logs/containers
```

### Health check
```bash
GET /api/status
```

## Development

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Type check
bun run check

# Build
bun run build
```

## Tech Stack

- **Frontend**: SvelteKit 2 + Svelte 5
- **Search**: Meilisearch
- **Docker**: dockerode
- **Runtime**: Bun

## License

MIT © [Marcel Beggiato](https://github.com/MBeggiato)
