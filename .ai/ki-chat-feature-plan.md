# KI Chat Feature - Detaillierter Implementierungsplan

## Übersicht

Implementierung eines KI-gestützten Chat-Features in Loggator, das Nutzern ermöglicht, natürlichsprachliche Fragen zu ihren Container-Logs zu stellen. Die KI analysiert Logs via Meilisearch und gibt kontextbezogene Antworten.

**Beispiel Use Cases:**

- "Warum läuft mein Container XY nicht mehr?"
- "Zeige mir alle Fehler der letzten Stunde"
- "Welche Container haben die meisten Warnungen?"
- "Was ist mit dem nginx Container passiert?"

---

## 1. Architektur & Technologie-Stack

### 1.1 Frontend (Svelte 5 + SvelteKit)

- **Integration**: Chat-Bubble auf Dashboard (kein `/chat` Route)
- **Komponenten**:
  - `ChatBubble.svelte` - Floating Action Button (rechts unten)
  - `ChatWindow.svelte` - Overlay/Modal mit Chat-UI
  - `ChatMessage.svelte` - Einzelne Nachricht (User/AI)
  - `ChatInput.svelte` - Eingabefeld mit Auto-Complete
  - `LogPreview.svelte` - Inline Log-Vorschau in Chat
  - `ToolCallIndicator.svelte` - Zeigt an, wenn AI Tools verwendet

### 1.2 Backend (SvelteKit Server)

- **API Routes**:
  - `POST /api/chat` - Haupt-Chat-Endpoint
  - `GET /api/chat/history` - Chat-Verlauf laden
  - `POST /api/chat/clear` - Chat-Verlauf löschen
  - `GET /api/chat/suggestions` - Vorschläge für Fragen

### 1.3 KI-Provider Integration

**OpenRouter** als unified API Gateway:

- Zugriff auf 300+ Modelle über eine API
- Automatisches Fallback und Load Balancing
- Kostenoptimierung durch intelligentes Routing
- OpenAI SDK-kompatibel (einfache Integration)

**Empfohlene Modelle** (via OpenRouter):

1. **Google Gemini 2.0 Flash** - `google/gemini-2.0-flash-thinking-exp:free` (kostenlos!)
2. **DeepSeek R1** - `deepseek/deepseek-r1` (sehr günstig, exzellentes Reasoning)
3. **OpenAI GPT-4o** - `openai/gpt-4o` (Premium-Option)
4. **Anthropic Claude 3.5 Sonnet** - `anthropic/claude-3.5-sonnet`

**Konfiguration via Umgebungsvariablen:**

```env
OPENROUTER_API_KEY=sk-or-v1-...
AI_MODEL=google/gemini-2.0-flash-thinking-exp:free
SITE_URL=https://your-loggator-instance.com  # Optional: für Rankings
SITE_NAME=Loggator  # Fest gesetzt für OpenRouter Rankings
```

---

## 2. KI Tool/Function Calling System

### 2.1 Tool Definitionen

Die KI erhält Zugriff auf folgende Tools:

#### **Tool 1: `search_logs`**

```typescript
{
  name: "search_logs",
  description: "Durchsucht Container-Logs mit Volltextsuche und Filtern",
  parameters: {
    query: string,           // Suchbegriff (z.B. "error", "failed")
    container?: string,      // Container-Name oder ID
    level?: string[],        // Log-Level: error, warn, info, debug
    startTime?: string,      // ISO 8601 Timestamp
    endTime?: string,        // ISO 8601 Timestamp
    limit?: number           // Max. Anzahl Ergebnisse (default: 50)
  }
}
```

#### **Tool 2: `get_container_info`**

```typescript
{
  name: "get_container_info",
  description: "Liefert Details zu einem Container (Status, Image, etc.)",
  parameters: {
    containerName: string    // Name oder ID
  }
}
```

#### **Tool 3: `analyze_container_health`**

```typescript
{
  name: "analyze_container_health",
  description: "Analysiert Container-Gesundheit anhand Log-Patterns",
  parameters: {
    containerName: string,
    minutes?: number         // Zeitfenster (default: 60)
  }
}
```

#### **Tool 4: `get_error_summary`**

```typescript
{
  name: "get_error_summary",
  description: "Erstellt Zusammenfassung von Errors/Warnings",
  parameters: {
    containerName?: string,  // Optional: spezifischer Container
    minutes?: number         // Zeitfenster (default: 60)
  }
}
```

### 2.2 Tool Implementation

**Server-Datei**: `src/lib/server/ai-tools.ts`

```typescript
import { searchLogs } from './meilisearch-indexer';
import { getContainerInfo } from './docker-collector';

export const tools = [
	{
		type: 'function',
		function: {
			name: 'search_logs',
			description:
				'Durchsucht Container-Logs mit Volltextsuche und Filtern. Nutze dies um spezifische Log-Einträge zu finden.',
			parameters: {
				type: 'object',
				properties: {
					query: { type: 'string', description: "Suchbegriff (z.B. 'error', 'failed', 'timeout')" },
					container: { type: 'string', description: 'Container-Name (optional)' },
					level: {
						type: 'array',
						items: { type: 'string' },
						description: 'Log-Level Filter: error, warn, info, debug'
					},
					limit: { type: 'number', description: 'Max. Anzahl Ergebnisse (default: 50)' }
				},
				required: ['query']
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'get_container_info',
			description: 'Liefert aktuelle Informationen zu einem Container (Status, Image, Uptime)',
			parameters: {
				type: 'object',
				properties: {
					containerName: { type: 'string', description: 'Name oder ID des Containers' }
				},
				required: ['containerName']
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'analyze_container_health',
			description: 'Analysiert die Gesundheit eines Containers anhand seiner Logs',
			parameters: {
				type: 'object',
				properties: {
					containerName: { type: 'string', description: 'Name des Containers' },
					minutes: { type: 'number', description: 'Zeitfenster in Minuten (default: 60)' }
				},
				required: ['containerName']
			}
		}
	}
];

export async function executeToolCall(toolName: string, args: any): Promise<any> {
	switch (toolName) {
		case 'search_logs':
			return await searchLogs(args);
		case 'get_container_info':
			return await getContainerInfo(args.containerName);
		case 'analyze_container_health':
			return await analyzeContainerHealth(args);
		default:
			throw new Error(`Unknown tool: ${toolName}`);
	}
}
```

---

## 3. Chat-Backend Implementierung

### 3.1 Haupt-Chat-Endpoint

**Datei**: `src/routes/api/chat/+server.ts`

```typescript
import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import { tools, executeToolCall } from '$lib/server/ai-tools';
import { OPENROUTER_API_KEY, AI_MODEL, SITE_URL } from '$env/static/private';

// OpenRouter via OpenAI SDK (vollständig kompatibel)
const openai = new OpenAI({
	baseURL: 'https://openrouter.ai/api/v1',
	apiKey: OPENROUTER_API_KEY,
	defaultHeaders: {
		'HTTP-Referer': SITE_URL || 'http://localhost:5173',
		'X-Title': 'Loggator' // Fest gesetzt für OpenRouter Rankings
	}
});

export const POST: RequestHandler = async ({ request }) => {
	const { messages } = await request.json();

	// System Prompt definieren
	const systemMessage = {
		role: 'system',
		content: `Du bist ein hilfreicher Assistent für die Loggator Docker Log-Analyse-Plattform.
    
Deine Aufgaben:
- Analysiere Container-Logs und beantworte Fragen darüber
- Nutze die verfügbaren Tools, um präzise Informationen zu liefern
- Erkläre Fehler und Probleme verständlich
- Gib konkrete Lösungsvorschläge

Wichtig:
- Antworte auf Deutsch (außer User fragt auf Englisch)
- Sei präzise und technisch korrekt
- Zitiere relevante Log-Einträge mit Markdown-Code-Blöcken
- Gib Timestamps an, wenn relevant
- Nutze IMMER die Tools bevor du antwortest - rate nicht!
- Wenn du unsicher bist, frage nach mehr Details`
	};

	let allMessages = [systemMessage, ...messages];
	let response = await openai.chat.completions.create({
		model: AI_MODEL || 'google/gemini-2.0-flash-thinking-exp:free',
		messages: allMessages,
		tools: tools,
		tool_choice: 'auto'
	});

	// Tool Calling Loop (OpenRouter-kompatibel)
	let iterations = 0;
	const MAX_ITERATIONS = 5; // Verhindere Endlosschleifen

	while (response.choices[0].finish_reason === 'tool_calls' && iterations < MAX_ITERATIONS) {
		iterations++;
		const toolCalls = response.choices[0].message.tool_calls;

		// WICHTIG: Assistant-Message mit tool_calls hinzufügen
		allMessages.push(response.choices[0].message);

		// Tools ausführen und Ergebnisse sammeln
		for (const toolCall of toolCalls) {
			try {
				const args = JSON.parse(toolCall.function.arguments);
				const result = await executeToolCall(toolCall.function.name, args);

				// Tool-Ergebnis als tool-Message hinzufügen
				allMessages.push({
					role: 'tool',
					tool_call_id: toolCall.id,
					content: JSON.stringify(result)
				});
			} catch (error) {
				console.error(`Tool execution error: ${toolCall.function.name}`, error);
				// Fehler als Tool-Response zurückgeben
				allMessages.push({
					role: 'tool',
					tool_call_id: toolCall.id,
					content: JSON.stringify({ error: String(error) })
				});
			}
		}

		// Nächste Anfrage mit Tool-Ergebnissen (tools-Parameter erforderlich!)
		response = await openai.chat.completions.create({
			model: AI_MODEL || 'google/gemini-2.0-flash-thinking-exp:free',
			messages: allMessages,
			tools: tools, // WICHTIG: Muss bei jeder Anfrage dabei sein
			tool_choice: 'auto'
		});
	}

	return new Response(
		JSON.stringify({
			message: response.choices[0].message.content,
			toolCalls: response.choices[0].message.tool_calls || []
		}),
		{ headers: { 'Content-Type': 'application/json' } }
	);
};
```

### 3.2 Streaming Support (Optional, für bessere UX)

**Streaming-Variante** für Echtzeit-Antworten:

```typescript
export const POST: RequestHandler = async ({ request }) => {
	const { messages } = await request.json();

	const stream = await openai.chat.completions.create({
		model: 'gpt-4o',
		messages: [systemMessage, ...messages],
		tools: tools,
		stream: true
	});

	const encoder = new TextEncoder();
	const readable = new ReadableStream({
		async start(controller) {
			for await (const chunk of stream) {
				const content = chunk.choices[0]?.delta?.content || '';
				controller.enqueue(encoder.encode(`data: ${content}\n\n`));
			}
			controller.close();
		}
	});

	return new Response(readable, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache'
		}
	});
};
```

---

## 4. Frontend Chat-UI

### 4.1 Chat-Bubble Komponente

**Datei**: `src/lib/components/ChatBubble.svelte`

```svelte
<script lang="ts">
	import { MessageSquare, X } from 'lucide-svelte';
	import { Button } from '$lib/components/ui';
	import ChatWindow from './ChatWindow.svelte';

	let isOpen = $state(false);
</script>

<!-- Floating Action Button -->
{#if !isOpen}
	<button
		onclick={() => (isOpen = true)}
		class="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-transform z-50 flex items-center justify-center"
		aria-label="KI-Assistent öffnen"
	>
		<MessageSquare class="h-6 w-6" />
	</button>
{/if}

<!-- Chat Window Overlay -->
{#if isOpen}
	<ChatWindow onClose={() => (isOpen = false)} />
{/if}
```

### 4.2 Chat-Window Komponente

**Datei**: `src/lib/components/ChatWindow.svelte`

```svelte
<script lang="ts">
	import { X, Send, Loader2 } from 'lucide-svelte';
	import { Button } from '$lib/components/ui';
	import ChatMessage from './ChatMessage.svelte';
	import { t } from '$lib/i18n';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	interface Message {
		id: string;
		role: 'user' | 'assistant';
		content: string;
		timestamp: Date;
		toolCalls?: ToolCall[];
	}

	let messages = $state<Message[]>([]);
	let input = $state('');
	let isLoading = $state(false);

	async function sendMessage() {
		if (!input.trim()) return;

		const userMessage: Message = {
			id: crypto.randomUUID(),
			role: 'user',
			content: input,
			timestamp: new Date()
		};

		messages = [...messages, userMessage];
		input = '';
		isLoading = true;

		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages: messages.map((m) => ({
						role: m.role,
						content: m.content
					}))
				})
			});

			const data = await response.json();

			messages = [
				...messages,
				{
					id: crypto.randomUUID(),
					role: 'assistant',
					content: data.message,
					timestamp: new Date(),
					toolCalls: data.toolCalls
				}
			];
		} catch (error) {
			console.error('Chat error:', error);
			// Toast-Benachrichtigung
		} finally {
			isLoading = false;
		}
	}
</script>

<!-- Fixed Overlay rechts unten -->
<div
	class="fixed bottom-6 right-6 w-[400px] h-[600px] bg-background border rounded-lg shadow-2xl z-50 flex flex-col"
>
	<!-- Header mit Close-Button -->
	<div class="flex items-center justify-between p-4 border-b">
		<div>
			<h2 class="text-lg font-semibold">{$t.chat.title}</h2>
			<p class="text-xs text-muted-foreground">{$t.chat.subtitle}</p>
		</div>
		<Button variant="ghost" size="icon" onclick={onClose}>
			<X class="h-4 w-4" />
		</Button>
	</div>

	<!-- Chat Messages -->
	<div class="flex-1 overflow-y-auto space-y-3 p-4">
		{#if messages.length === 0}
			<div class="text-center py-12">
				<p class="text-muted-foreground mb-4">
					{$t.chat.emptyState}
				</p>
				<div class="flex flex-wrap gap-2 justify-center">
					<button
						onclick={() => (input = 'Zeige mir alle Fehler der letzten Stunde')}
						class="px-3 py-2 text-sm bg-accent rounded-lg hover:bg-accent/80"
					>
						💡 {$t.chat.suggestion1}
					</button>
					<button
						onclick={() => (input = 'Welche Container laufen gerade?')}
						class="px-3 py-2 text-sm bg-accent rounded-lg hover:bg-accent/80"
					>
						💡 {$t.chat.suggestion2}
					</button>
				</div>
			</div>
		{:else}
			{#each messages as message}
				<ChatMessage {message} />
			{/each}
		{/if}

		{#if isLoading}
			<div class="flex items-center gap-2 text-muted-foreground">
				<div
					class="animate-spin h-4 w-4 border-2 border-primary rounded-full border-t-transparent"
				/>
				<span>{$t.chat.thinking}</span>
			</div>
		{/if}
	</div>

	<!-- Input -->
	<div class="p-4 border-t">
		<div class="flex gap-2">
			<input
				bind:value={input}
				onkeydown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
				placeholder={$t.chat.inputPlaceholder}
				disabled={isLoading}
				class="flex-1 px-3 py-2 text-sm bg-accent rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
			/>
			<Button onclick={sendMessage} disabled={isLoading || !input.trim()} size="icon">
				{#if isLoading}
					<Loader2 class="h-4 w-4 animate-spin" />
				{:else}
					<Send class="h-4 w-4" />
				{/if}
			</Button>
		</div>
	</div>
</div>
```

### 4.2 Chat-Message-Komponente

**Datei**: `src/lib/components/ChatMessage.svelte`

```svelte
<script lang="ts">
	import { Badge } from '$lib/components/ui';
	import { Bot, User, Wrench } from 'lucide-svelte';

	interface Props {
		message: {
			role: 'user' | 'assistant';
			content: string;
			timestamp: Date;
			toolCalls?: any[];
		};
	}

	let { message }: Props = $props();
</script>

<div class="flex gap-3 {message.role === 'user' ? 'justify-end' : ''}">
	{#if message.role === 'assistant'}
		<div class="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
			<Bot class="h-4 w-4 text-primary" />
		</div>
	{/if}

	<div class="max-w-[80%]">
		<div
			class="rounded-lg p-4 {message.role === 'user'
				? 'bg-primary text-primary-foreground ml-auto'
				: 'bg-accent'}"
		>
			<div class="prose prose-sm dark:prose-invert">
				{@html message.content}
			</div>
		</div>

		{#if message.toolCalls && message.toolCalls.length > 0}
			<div class="mt-2 flex flex-wrap gap-1">
				{#each message.toolCalls as tool}
					<Badge variant="outline" class="text-xs">
						<Wrench class="h-3 w-3 mr-1" />
						{tool.function.name}
					</Badge>
				{/each}
			</div>
		{/if}

		<div class="text-xs text-muted-foreground mt-1">
			{message.timestamp.toLocaleTimeString('de-DE')}
		</div>
	</div>

	{#if message.role === 'user'}
		<div class="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
			<User class="h-4 w-4" />
		</div>
	{/if}
</div>
```

---

## 5. Meilisearch Integration

### 5.1 Erweiterte Such-Funktionen

**Datei**: `src/lib/server/ai-tools.ts`

```typescript
import { MeiliSearch } from 'meilisearch';

const client = new MeiliSearch({
	host: process.env.MEILISEARCH_URL || 'http://localhost:7700',
	apiKey: process.env.MEILISEARCH_KEY
});

export async function searchLogs(params: {
	query: string;
	container?: string;
	level?: string[];
	startTime?: string;
	endTime?: string;
	limit?: number;
}) {
	const filters: string[] = [];

	if (params.container) {
		filters.push(`container = "${params.container}"`);
	}

	if (params.level && params.level.length > 0) {
		const levelFilter = params.level.map((l) => `level = "${l}"`).join(' OR ');
		filters.push(`(${levelFilter})`);
	}

	if (params.startTime) {
		filters.push(`timestamp >= ${new Date(params.startTime).getTime()}`);
	}

	if (params.endTime) {
		filters.push(`timestamp <= ${new Date(params.endTime).getTime()}`);
	}

	const index = client.index('logs');
	const results = await index.search(params.query, {
		filter: filters.join(' AND '),
		limit: params.limit || 50,
		sort: ['timestamp:desc']
	});

	return {
		total: results.estimatedTotalHits,
		logs: results.hits.map((hit) => ({
			id: hit.id,
			container: hit.container,
			message: hit.message,
			level: hit.level,
			timestamp: new Date(hit.timestamp).toISOString()
		}))
	};
}

export async function analyzeContainerHealth(params: { containerName: string; minutes?: number }) {
	const minutes = params.minutes || 60;
	const startTime = new Date(Date.now() - minutes * 60 * 1000);

	const index = client.index('logs');

	// Fehler zählen
	const errors = await index.search('', {
		filter: `container = "${params.containerName}" AND level = "error" AND timestamp >= ${startTime.getTime()}`,
		limit: 0
	});

	// Warnungen zählen
	const warnings = await index.search('', {
		filter: `container = "${params.containerName}" AND level = "warn" AND timestamp >= ${startTime.getTime()}`,
		limit: 0
	});

	// Letzte Logs holen
	const recentLogs = await index.search('', {
		filter: `container = "${params.containerName}" AND timestamp >= ${startTime.getTime()}`,
		limit: 10,
		sort: ['timestamp:desc']
	});

	return {
		containerName: params.containerName,
		timeWindow: `${minutes} Minuten`,
		errorCount: errors.estimatedTotalHits,
		warningCount: warnings.estimatedTotalHits,
		totalLogs: recentLogs.estimatedTotalHits,
		recentLogs: recentLogs.hits
	};
}
```

---

## 6. Internationalisierung (i18n)

### 6.1 Deutsche Übersetzungen

**Datei**: `src/lib/i18n/translations/de.ts`

```typescript
export const de = {
	// ... bestehende Übersetzungen
	chat: {
		title: 'KI Log-Assistent',
		subtitle: 'Stellen Sie Fragen zu Ihren Container-Logs',
		inputPlaceholder: 'Fragen Sie etwas über Ihre Logs...',
		send: 'Senden',
		thinking: 'KI analysiert...',
		emptyState: 'Stellen Sie eine Frage zu Ihren Container-Logs',
		suggestion1: 'Zeige mir alle Fehler der letzten Stunde',
		suggestion2: 'Welche Container laufen gerade?',
		suggestion3: 'Was ist mit dem nginx Container passiert?',
		clearHistory: 'Verlauf löschen'
	}
};
```

### 6.2 Englische Übersetzungen

**Datei**: `src/lib/i18n/translations/en.ts`

```typescript
export const en = {
	// ... existing translations
	chat: {
		title: 'AI Log Assistant',
		subtitle: 'Ask questions about your container logs',
		inputPlaceholder: 'Ask something about your logs...',
		send: 'Send',
		thinking: 'AI is analyzing...',
		emptyState: 'Ask a question about your container logs',
		suggestion1: 'Show me all errors from the last hour',
		suggestion2: 'Which containers are currently running?',
		suggestion3: 'What happened to the nginx container?',
		clearHistory: 'Clear history'
	}
};
```

---

## 7. Dashboard Integration

**Datei**: `src/routes/+page.svelte` (Dashboard)

```svelte
<script lang="ts">
	// ... bestehende Imports
	import ChatBubble from '$lib/components/ChatBubble.svelte';
</script>

<div class="p-6 space-y-6">
	<!-- ... bestehender Dashboard-Content ... -->
</div>

<!-- Chat Bubble (erscheint über allem) -->
<ChatBubble />
```

**Hinweis**: Chat-Bubble wird nur auf dem Dashboard angezeigt. Kann später auch auf anderen Seiten aktiviert werden.

---

## 8. Sicherheit & Best Practices

### 8.1 API-Key-Verwaltung

- ✅ API-Keys nur in Umgebungsvariablen
- ✅ Niemals im Frontend-Code
- ✅ Rate Limiting implementieren (z.B. 10 Anfragen/Minute/User)

### 8.2 Input-Validierung

```typescript
// Server-seitig alle Inputs validieren
function validateChatRequest(data: any) {
	if (!data.messages || !Array.isArray(data.messages)) {
		throw new Error('Invalid messages format');
	}

	if (data.messages.length > 50) {
		throw new Error('Too many messages');
	}

	// Max. Message-Länge
	for (const msg of data.messages) {
		if (msg.content.length > 10000) {
			throw new Error('Message too long');
		}
	}
}
```

### 8.3 Cost Control

- Token-Limits setzen (max_tokens: 1000)
- Logging von API-Kosten
- Optional: Budget-Alerts via Umgebungsvariable

---

## 9. Testing-Strategie

### 9.1 Unit Tests

```typescript
// tests/ai-tools.test.ts
import { describe, it, expect } from 'vitest';
import { searchLogs } from '$lib/server/ai-tools';

describe('AI Tools', () => {
	it('should search logs with filters', async () => {
		const result = await searchLogs({
			query: 'error',
			container: 'nginx',
			level: ['error'],
			limit: 10
		});

		expect(result.logs).toBeDefined();
		expect(result.total).toBeGreaterThanOrEqual(0);
	});
});
```

### 9.2 Integration Tests

- Chat-Flow End-to-End testen
- Mock-Responses für KI-Provider
- Meilisearch-Integration testen

---

## 10. Deployment & Konfiguration

### 10.1 Docker Compose Erweiterung

**Datei**: `docker-compose.yml`

```yaml
services:
  loggator:
    environment:
      # Bestehende Variablen...

      # OpenRouter KI-Chat Konfiguration
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - AI_MODEL=${AI_MODEL:-google/gemini-2.0-flash-thinking-exp:free}
      - SITE_URL=${SITE_URL:-http://localhost:5173}
      # SITE_NAME ist fest auf "Loggator" im Code gesetzt
OPENROUTER_API_KEY=sk-or-v1-...  # Von https://openrouter.ai/keys
AI_MODEL=google/gemini-2.0-flash-thinking-exp:free  # Kostenlos!
# Alternative Modelle:
# AI_MODEL=deepseek/deepseek-r1  # Sehr günstig (~$0.55/M tokens)
# AI_MODEL=openai/gpt-4o  # Premium (~$2.5/M input, $10/M output)
SITE_URL=https://your-domain.com  # Optional: Deine Loggator-Installation
# SITE_NAME wird fest auf "Loggator" gesetzt (nicht konfigurierbar)
AI_MAX_TOKENS=2000
AI_RATE_LIMIT=10
```

### 10.3 OpenRouter API Key erstellen

1. Gehe zu https://openrouter.ai/
2. Registriere dich (kostenlos)
3. Gehe zu https://openrouter.ai/keys
4. Erstelle einen neuen API Key
5. Optional: Lade Guthaben auf (für Premium-Modelle)
6. **Gemini 2.0 Flash ist kostenlos!**

---

## 11. Erweiterungsmöglichkeiten (Future)

### Phase 2 Features:

1. **Chat-Verlauf persistieren** (SQLite/Postgres)
2. **Multi-User Support** mit separaten Chat-Sessions
3. **Voice Input** (Whisper API)
4. **Exportieren von Konversationen** (Markdown/PDF)
5. **Custom Prompts** (User kann System-Prompt anpassen)
6. **Log-Pattern-Erkennung** (KI schlägt Alerts vor)
7. **Automatische Problem-Reports** (Wöchentliche Zusammenfassung)

### Phase 3 Features:

1. **RAG (Retrieval Augmented Generation)** mit Vektor-DB
2. **Automatische Incident-Analyse**
3. **Predictive Analytics** (KI sagt Probleme vorher)
4. **Integration mit Ticketing-Systemen**

---

## 12. Implementierungs-Schritte

### Schritt 1: OpenRouter Setup (15min)

- [ ] OpenRouter Account erstellen
- [ ] API Key generieren
- [ ] `.env` Datei aktualisieren
- [ ] `openai` Package installieren (`npm install openai`)

### Schritt 2: Backend-Basis (2-3h)

- [ ] `src/lib/server/ai-tools.ts` erstellen
- [ ] Tools implementieren (`search_logs`, `get_container_info`, `analyze_container_health`)
- [ ] `src/routes/api/chat/+server.ts` Endpoint erstellen
- [ ] OpenRouter Integration via OpenAI SDK + Tool Calling

### Schritt 3: Frontend-UI (2-3h)

- [ ] `ChatBubble.svelte` Komponente erstellen
- [ ] `ChatWindow.svelte` Komponente implementieren
- [ ] `ChatMessage.svelte` Komponente implementieren
- [ ] ChatBubble auf Dashboard einbinden

### Schritt 3: i18n & Styling (1h)

- [ ] Übersetzungen hinzufügen (DE/EN)
- [ ] UI polieren
- [ ] Responsive Design testen

### Schritt 4: Testing & Refinement (2h)

- [ ] E2E Tests schreiben
- [ ] Error Handling verbessern
- [ ] Rate Limiting implementieren

### Schritt 5: Dokumentation (1h)

- [ ] README aktualisieren
- [ ] API-Dokumentation
- [ ] User-Guide

**Geschätzte Gesamtzeit**: 9-11 Stunden

---

## 13. Kosten-Kalkulation (OpenRouter)

### 🎉 Kostenlose Option: Google Gemini 2.0 Flash

- **Model**: `google/gemini-2.0-flash-thinking-exp:free`
- **Kosten**: $0 (komplett kostenlos!)
- **Limits**: Fair-Use Policy von OpenRouter
- **Features**: Exzellentes Reasoning, Tool Calling Support
- ✅ **Empfohlen für den Start!**

### Günstige Alternative: DeepSeek R1

- **Model**: `deepseek/deepseek-r1`
- **Input**: $0.55 / 1M Tokens
- **Output**: $2.19 / 1M Tokens
- **Beispiel-Rechnung** (1000 Anfragen/Monat):
  - Ø 500 Tokens Input = 500k → $0.28
  - Ø 300 Tokens Output = 300k → $0.66
  - **Total**: ~$0.94/Monat

### Premium: OpenAI GPT-4o (via OpenRouter)

- **Input**: $2.50 / 1M Tokens
- **Output**: $10.00 / 1M Tokens
- **Beispiel**: 1000 Anfragen/Monat → ~$3.25/Monat

### Claude 3.5 Sonnet (via OpenRouter)

- **Input**: $3.00 / 1M Tokens
- **Output**: $15.00 / 1M Tokens
- Beste Reasoning-Fähigkeiten für komplexe Probleme

### 💡 OpenRouter Vorteile

- Automatisches Fallback bei Ausfällen
- Zugriff auf 300+ Modelle über eine API
- Kostenoptimierung durch Model-Routing
- Detaillierte Nutzungsstatistiken

---

## 14. Fazit

Dieses Feature macht Loggator zu einem **intelligenten Log-Analyse-Tool**, das komplexe Debugging-Aufgaben vereinfacht. Die modulare Architektur ermöglicht einfache Erweiterungen und verschiedene KI-Provider.

**Quick Wins**:

- Drastisch reduzierte Zeit für Log-Analyse
- Natürlichsprachliche Interaktion statt komplexer Queries
- Automatische Pattern-Erkennung
- Bessere Incident-Response

**Nächste Schritte**: Mit Schritt 1 (Backend-Basis) beginnen! 🚀
