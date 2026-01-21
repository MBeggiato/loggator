# Notification System mit Apprise

Loggator verwendet **Apprise** für das Benachrichtigungssystem. Apprise ist eine leistungsstarke Python-Bibliothek, die über 80 verschiedene Notification-Services unterstützt.

## Features

- 🔔 **80+ Notification-Services**: Slack, Discord, Email, Telegram, MS Teams, und viele mehr
- 🤖 **AI-generierte Fehler-Zusammenfassungen**: Automatisch erstellte Problemanalysen
- 🎯 **Flexible Filter**: Nach Container-Namen und Fehler-Severity
- 🚫 **Spam-Schutz**: 15-Minuten-Cooldown zwischen gleichen Benachrichtigungen
- ✅ **Test-Funktion**: Testen Sie jeden Channel vor dem Einsatz

## Quick Start

### 1. Starten Sie das System

```bash
docker compose up -d
```

Das System startet automatisch:

- **Loggator** auf Port 3000
- **Apprise API** auf Port 8000
- **Meilisearch** auf Port 7700

### 2. Konfigurieren Sie einen Channel

1. Öffnen Sie [http://localhost:3000/notifications](http://localhost:3000/notifications)
2. Klicken Sie auf "Channel hinzufügen"
3. Geben Sie die Apprise-URL und Filter ein
4. Testen Sie den Channel mit dem "Test"-Button

## Unterstützte Services (Auswahl)

### Chat & Collaboration

| Service      | URL-Format                             | Beispiel                                 |
| ------------ | -------------------------------------- | ---------------------------------------- |
| **Slack**    | `slack://TokenA/TokenB/TokenC/Channel` | `slack://T1234/B5678/xoxb-token/general` |
| **Discord**  | `discord://webhook_id/webhook_token`   | `discord://123456789/AbCdEfGhIjKlMnOp`   |
| **MS Teams** | `msteams://TokenA/TokenB/TokenC`       | `msteams://abc/def/ghi`                  |
| **Telegram** | `tgram://bottoken/ChatID`              | `tgram://123456:ABC-DEF/123456789`       |
| **Matrix**   | `matrix://token@hostname/#room`        | `matrix://token@matrix.org/#loggator`    |

### Email

| Service   | URL-Format                             | Beispiel                                |
| --------- | -------------------------------------- | --------------------------------------- |
| **Gmail** | `mailto://user:pass@gmail.com`         | `mailto://alerts@gmail.com`             |
| **SMTP**  | `mailtos://user:pass@smtp.example.com` | `mailtos://admin:pass@mail.company.com` |

### Incident Management

| Service       | URL-Format                          | Beispiel                      |
| ------------- | ----------------------------------- | ----------------------------- |
| **PagerDuty** | `pagerduty://IntegrationKey@ApiKey` | `pagerduty://R0123456@abc123` |
| **Opsgenie**  | `opsgenie://APIKey`                 | `opsgenie://abc-def-ghi-jkl`  |

### Custom

| Service            | URL-Format             | Beispiel                           |
| ------------------ | ---------------------- | ---------------------------------- |
| **Webhook (JSON)** | `json://hostname/path` | `json://api.company.com/alerts`    |
| **Webhook (Form)** | `form://hostname/path` | `form://alerts.company.com/notify` |

> **Vollständige Liste**: Siehe [Apprise Dokumentation](https://github.com/caronc/apprise)

## Konfiguration

### Channel Settings

- **Name**: Beschreibender Name für den Channel
- **Apprise URL**: Service-URL (siehe Tabelle oben)
- **Container Filter** (optional):
  - Leer = alle Container
  - `myapp` = nur Container "myapp"
  - `prod-*` = alle Container die mit "prod-" beginnen
  - `app1, app2` = nur Container "app1" und "app2"
- **Mindest-Severity**:
  - `low`: Alle Fehler
  - `medium`: Medium, High, Critical
  - `high`: High und Critical
  - `critical`: Nur Critical

### Error Severity Levels

Das System klassifiziert Fehler automatisch:

| Level           | Beschreibung                         | Beispiele                              |
| --------------- | ------------------------------------ | -------------------------------------- |
| **Low** 💡      | Informative Fehler                   | Timeouts, retry-fähige Fehler          |
| **Medium** ⚠️   | Probleme die Aufmerksamkeit brauchen | Connection refused, DNS errors         |
| **High** 🔴     | Ernste Probleme                      | Segmentation faults, out of memory     |
| **Critical** 🚨 | Systemkritische Fehler               | Database connection lost, fatal errors |

## Apprise URL Beispiele

### Slack

```
# Webhook (empfohlen)
slack://TokenA/TokenB/TokenC/channel-name

# Legacy Webhook
slack://webhook@workspace/token

# Mit Custom Bot Name
slack://botname@TokenA/TokenB/TokenC/channel
```

### Discord

```
# Webhook
discord://webhook_id/webhook_token

# Mit Avatar
discord://avatar@webhook_id/webhook_token
```

### Email (Gmail)

```
# Basis
mailto://user:app-password@gmail.com

# Mit Empfänger
mailto://sender:password@gmail.com/recipient@example.com

# Mehrere Empfänger
mailto://sender:password@gmail.com/user1@example.com/user2@example.com
```

### Telegram

```
# Basis
tgram://bottoken/ChatID

# Bot mit mehreren Chats
tgram://123456:ABC-DEF/123456789/987654321
```

### MS Teams

```
# Workflow (neu)
workflows://WorkflowID/Signature

# Legacy Webhook
msteams://TokenA/TokenB/TokenC
```

### Generic Webhook

```
# JSON POST
json://hostname/path
json://user:pass@hostname:8080/api/alerts

# Form POST
form://hostname/path
```

## Error Detection

Das System erkennt automatisch folgende Fehler-Patterns:

```typescript
{
  "error": /error|exception|failed|failure/i,          // Severity: medium
  "fatal": /fatal|critical|emergency/i,                // Severity: critical
  "warning": /warn|warning|caution/i,                  // Severity: low
  "connection": /connection (refused|timeout|reset)/i, // Severity: high
  "out_of_memory": /out of memory|oom/i,              // Severity: critical
  "segfault": /segmentation fault|segfault/i,         // Severity: critical
  "panic": /panic:|panic\(/i,                         // Severity: critical
  "timeout": /timeout|timed out/i                     // Severity: low
}
```

### Threshold Settings

Benachrichtigungen werden gesendet, wenn:

- **Low**: 20+ Fehler in 5 Minuten
- **Medium**: 10+ Fehler in 5 Minuten
- **High**: 5+ Fehler in 5 Minuten
- **Critical**: 1+ Fehler sofort

## AI-Generated Summaries

Das System verwendet OpenRouter AI (default: `xiaomi/mimo-v2-flash:free`) um Fehler-Zusammenfassungen zu erstellen.

### Setup

```bash
# In .env oder docker-compose.yml
OPENROUTER_API_KEY=your-api-key
AI_MODEL=xiaomi/mimo-v2-flash:free  # oder anderes Modell
```

### Summary Format

Jede Benachrichtigung enthält:

1. **Titel**: Kurze Problembeschreibung
2. **Problem**: Detaillierte Analyse
3. **Lösung**: AI-generierte Lösungsvorschläge
4. **Context**: Betroffene Container, Anzahl, Zeitraum

Beispiel:

```
🚨 CRITICAL

Problem:
Database connection pool exhausted. MySQL max_connections limit reached.

Lösung:
1. Erhöhen Sie max_connections in MySQL config
2. Prüfen Sie auf Connection Leaks im Application Code
3. Implementieren Sie Connection Pooling mit Timeout

Betroffene Container: myapp-backend
Fehleranzahl: 15
Zeitraum: 14:23:10 - 14:25:45
```

## API Endpoints

### GET /api/notifications/channels

Gibt alle konfigurierten Channels zurück.

```bash
curl http://localhost:3000/api/notifications/channels
```

Response:

```json
{
	"success": true,
	"channels": [
		{
			"id": "abc-123",
			"name": "Team Slack",
			"url": "slack://...",
			"enabled": true,
			"filters": {
				"containers": ["prod-*"],
				"minSeverity": "high"
			},
			"createdAt": "2024-01-01T00:00:00Z",
			"updatedAt": "2024-01-01T00:00:00Z"
		}
	]
}
```

### POST /api/notifications/channels

Erstellt oder aktualisiert einen Channel.

```bash
curl -X POST http://localhost:3000/api/notifications/channels \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-channel",
    "name": "Production Alerts",
    "url": "slack://T123/B456/xoxb-789/alerts",
    "enabled": true,
    "filters": {
      "containers": ["prod-*"],
      "minSeverity": "high"
    }
  }'
```

### DELETE /api/notifications/channels?id=...

Löscht einen Channel.

```bash
curl -X DELETE "http://localhost:3000/api/notifications/channels?id=my-channel"
```

### POST /api/notifications/test

Sendet eine Test-Benachrichtigung.

```bash
curl -X POST http://localhost:3000/api/notifications/test \
  -H "Content-Type: application/json" \
  -d '{"channelId": "my-channel"}'
```

## Environment Variables

```bash
# Apprise API URL (default: http://apprise:8000)
APPRISE_API_URL=http://apprise:8000

# OpenRouter API für AI Summaries
OPENROUTER_API_KEY=your-key

# AI Model (default: xiaomi/mimo-v2-flash:free)
AI_MODEL=anthropic/claude-3.5-sonnet

# Meilisearch
MEILISEARCH_HOST=http://meilisearch:7700
MEILISEARCH_API_KEY=your-key

# Docker Filter
DOCKER_LABEL_FILTER=loggator.enable=true
```

## Troubleshooting

### Channel Test schlägt fehl

1. Prüfen Sie die Apprise URL Syntax
2. Testen Sie die URL direkt:
   ```bash
   curl -X POST http://localhost:8000/notify \
     -H "Content-Type: application/json" \
     -d '{"urls": "your-url", "body": "Test"}'
   ```
3. Prüfen Sie Apprise Container Logs:
   ```bash
   docker logs loggator-apprise
   ```

### Keine Benachrichtigungen erhalten

1. Prüfen Sie, ob Channel aktiviert ist
2. Prüfen Sie Filter-Einstellungen (Container, Severity)
3. Prüfen Sie Cooldown (15 Minuten zwischen gleichen Benachrichtigungen)
4. Prüfen Sie Error Detection Thresholds
5. Logs prüfen:
   ```bash
   docker logs loggator
   ```

### Apprise Container startet nicht

```bash
# Container Status
docker ps -a | grep apprise

# Logs prüfen
docker logs loggator-apprise

# Neu starten
docker compose restart apprise
```

## Best Practices

### 1. Separate Channels für verschiedene Severities

```
- "Critical Alerts" → minSeverity: critical → PagerDuty
- "High Priority" → minSeverity: high → Slack #alerts
- "Monitoring" → minSeverity: medium → Slack #monitoring
```

### 2. Container-spezifische Channels

```
- "Production DB" → containers: ["postgres-prod"] → PagerDuty
- "Backend Services" → containers: ["*-backend"] → Slack
- "All Services" → containers: [] → Email Digest
```

### 3. Testing

- Testen Sie jeden Channel nach der Erstellung
- Verwenden Sie separate Test-Channels in Development
- Deaktivieren Sie Channels statt sie zu löschen

### 4. AI Summary Optimization

```bash
# Für bessere Summaries, verwenden Sie leistungsfähigere Modelle
AI_MODEL=anthropic/claude-3.5-sonnet
AI_MODEL=openai/gpt-4-turbo

# Für niedrige Kosten
AI_MODEL=xiaomi/mimo-v2-flash:free
```

## Support

- **Apprise Dokumentation**: https://github.com/caronc/apprise
- **Loggator Issues**: GitHub Repository
- **OpenRouter Models**: https://openrouter.ai/models

## License

MIT
