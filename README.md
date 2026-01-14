<p align="center">
  <img src="src/lib/assets/logo.png" alt="Loggator Logo" width="120" />
</p>

<h1 align="center">Loggator</h1>

<p align="center">
  <strong>Docker Log Aggregator mit Meilisearch</strong><br>
  Ein dockerisiertes System zur Aggregation, Indexierung und Durchsuchung von Container-Logs.
</p>

## Features

- 🔍 **Automatische Log-Erfassung**: Überwacht Docker-Container basierend auf Labels
- ⚡ **Schnelle Volltextsuche**: Powered by Meilisearch
- 🎨 **Moderne Web-UI**: Svelte 5 mit Runes
- 🐳 **Docker-native**: Läuft als Container parallel zu anderen Services
- 🔄 **Echtzeit-Updates**: Auto-Refresh der Logs

## Technologie-Stack

- **Frontend**: SvelteKit 2 mit Svelte 5 (Runes)
- **Backend**: TypeScript/Node.js (SvelteKit API Routes)
- **Docker-Integration**: dockerode
- **Such-Engine**: Meilisearch
- **Package Manager**: bun

## Installation & Setup

### 1. Repository klonen

```bash
git clone https://github.com/MBeggiato/loggator.git
cd loggator
```

### 2. Dependencies installieren

```bash
bun install
```

### 3. Environment-Variablen konfigurieren

```bash
cp .env.example .env
# .env bearbeiten und MEILISEARCH_MASTER_KEY ändern!
```

### 4. Mit Docker Compose starten

**Option A: Image von GitHub Container Registry verwenden (empfohlen)**

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
      - DOCKER_LABEL_FILTER=loggator.enable=true
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    depends_on:
      - meilisearch
```

**Option B: Lokal bauen**

```bash
docker-compose up -d
```

Die Anwendung ist dann verfügbar unter:

- **Loggator UI**: http://localhost:3000
- **Meilisearch**: http://localhost:7700

## Verwendung

### Container für Monitoring markieren

Füge das Label `loggator.enable=true` zu Containern hinzu, die überwacht werden sollen:

**docker-compose.yml:**

```yaml
services:
  my-service:
    image: my-app
    labels:
      - 'loggator.enable=true'
```

**Docker CLI:**

```bash
docker run -d --label loggator.enable=true my-app
```

### Logs durchsuchen

1. Öffne http://localhost:3000 im Browser
2. Verwende die Suchleiste für Volltextsuche
3. Filtere nach Container oder Stream (stdout/stderr)
4. Auto-Refresh aktualisiert die Logs alle 5 Sekunden

## API-Endpunkte

### GET /api/logs/search

Logs durchsuchen mit Query-Parametern:

- `q`: Suchbegriff
- `container`: Container-Name
- `stream`: stdout oder stderr
- `from`: Start-Timestamp (Unix ms)
- `to`: End-Timestamp (Unix ms)
- `limit`: Max. Ergebnisse (default: 100)
- `offset`: Offset für Pagination

**Beispiel:**

```bash
curl "http://localhost:3000/api/logs/search?q=error&container=demo-nginx&limit=50"
```

### GET /api/logs/containers

Liste aller überwachten Container

### GET /api/status

Service-Status und Health-Check

## Entwicklung

### Dev-Server starten

```bash
bun run dev
```

### Type-Checking

```bash
bun run check
```

### Linting & Formatting

```bash
bun run lint
bun run format
```

### Production Build

```bash
bun run build
bun run preview
```

## Architektur

```
┌─────────────────┐
│  Docker Engine  │
└────────┬────────┘
         │ Docker Socket
         ▼
┌─────────────────┐      ┌──────────────┐
│ Log Collector   │─────▶│ Meilisearch  │
│ (dockerode)     │      │   Indexer    │
└─────────────────┘      └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │  Meilisearch │
                         │    Server    │
                         └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │  SvelteKit   │
                         │   API + UI   │
                         └──────────────┘
```

### Komponenten

1. **Docker Log Collector** ([docker-collector.ts](src/lib/server/docker-collector.ts))
   - Überwacht Docker-Events
   - Streamt Logs von markierten Containern
   - Parst Docker Log Format

2. **Meilisearch Indexer** ([meilisearch-indexer.ts](src/lib/server/meilisearch-indexer.ts))
   - Batch-Indexierung von Logs
   - Such- und Filter-Funktionen
   - Container-Aggregation

3. **Log Aggregator Service** ([log-aggregator.ts](src/lib/server/log-aggregator.ts))
   - Koordiniert Collector und Indexer
   - Singleton-Pattern
   - Graceful Shutdown

4. **SvelteKit API Routes** ([src/routes/api](src/routes/api))
   - REST-Endpunkte für Suche
   - Container-Liste
   - Status-Checks

5. **Web UI** ([LogViewer.svelte](src/lib/components/LogViewer.svelte))
   - Svelte 5 mit Runes
   - Echtzeit-Suche und Filterung
   - Responsive Design

## Konfiguration

### Environment-Variablen

| Variable                 | Default                   | Beschreibung                    |
| ------------------------ | ------------------------- | ------------------------------- |
| `MEILISEARCH_HOST`       | `http://meilisearch:7700` | Meilisearch Server URL          |
| `MEILISEARCH_API_KEY`    | -                         | API Key für Meilisearch         |
| `MEILISEARCH_MASTER_KEY` | `masterKey123`            | Master Key (Production ändern!) |
| `DOCKER_LABEL_FILTER`    | `loggator.enable=true`    | Label-Filter für Container      |
| `PORT`                   | `3000`                    | Anwendungs-Port                 |
| `HOST`                   | `0.0.0.0`                 | Bind-Adresse                    |

### Label-basierte Container-Auswahl

Der Standard-Filter `loggator.enable=true` kann angepasst werden:

```bash
# Alle Container mit spezifischem Label-Wert
DOCKER_LABEL_FILTER=environment=production

# Label muss nur vorhanden sein
DOCKER_LABEL_FILTER=monitor
```

## Deployment

### Production Checklist

- [ ] `MEILISEARCH_MASTER_KEY` auf sicheren Wert ändern
- [ ] `MEILISEARCH_API_KEY` generieren (falls benötigt)
- [ ] Volume-Mappings prüfen
- [ ] Netzwerk-Konfiguration anpassen
- [ ] Reverse Proxy konfigurieren (optional)
- [ ] Log-Rotation einrichten (optional)

### Mit Custom Labels deployen

```yaml
services:
  loggator:
    # ...
    environment:
      - DOCKER_LABEL_FILTER=myapp.logs=true
```

## Troubleshooting

### Logs werden nicht erfasst

1. Prüfe, ob Container das richtige Label haben:

   ```bash
   docker inspect <container> | grep -A5 Labels
   ```

2. Überprüfe Loggator-Logs:

   ```bash
   docker logs loggator
   ```

3. Stelle sicher, dass Docker Socket gemountet ist

### Meilisearch-Verbindung fehlgeschlagen

1. Health-Check prüfen:

   ```bash
   docker ps
   curl http://localhost:7700/health
   ```

2. Master Key validieren
3. Netzwerk-Konnektivität testen

### Performance-Probleme

1. Batch-Größe in [meilisearch-indexer.ts](src/lib/server/meilisearch-indexer.ts#L10) anpassen
2. Meilisearch Ressourcen erhöhen
3. Log-Retention-Policy implementieren

## Lizenz

MIT

## Contributing

Contributions sind willkommen! Bitte erstelle einen Pull Request.
