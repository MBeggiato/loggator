import { MeiliSearch, type Index } from 'meilisearch';
import type { LogEntry } from './docker-collector';

export interface IndexedLog extends Omit<LogEntry, 'timestamp' | 'labels'> {
	id: string;
	timestamp: number;
	timestampISO: string;
	labels: string; // JSON string für Meilisearch
}

export class MeilisearchIndexer {
	private client: MeiliSearch;
	private index: Index;
	private batchBuffer: IndexedLog[] = [];
	private batchSize = 100;
	private batchTimeout: NodeJS.Timeout | null = null;
	private batchTimeoutMs = 5000; // 5 Sekunden

	constructor(host: string = 'http://meilisearch:7700', apiKey: string = '') {
		this.client = new MeiliSearch({ host, apiKey });
		this.index = this.client.index('logs');
	}

	async initialize(): Promise<void> {
		try {
			// Index erstellen falls nicht vorhanden oder existierenden holen
			try {
				this.index = this.client.index('logs');
				await this.index.getRawInfo();
				console.log('Using existing Meilisearch index: logs');
			} catch {
				// Index existiert nicht, erstelle ihn
				await this.client.createIndex('logs', { primaryKey: 'id' });
				this.index = this.client.index('logs');
				console.log('Created new Meilisearch index: logs');
			}

			// Suchbare Felder konfigurieren
			await this.index.updateSettings({
				searchableAttributes: ['message', 'containerName', 'containerId', 'labels'],
				filterableAttributes: [
					'containerName',
					'containerId',
					'stream',
					'timestamp',
					'timestampISO'
				],
				sortableAttributes: ['timestamp']
			});

			console.log('Meilisearch indexer initialized');
		} catch (error) {
			console.error('Error initializing Meilisearch:', error);
			throw error;
		}
	}

	async indexLog(log: LogEntry): Promise<void> {
		const indexedLog: IndexedLog = {
			id: `${log.containerId}-${log.timestamp.getTime()}-${Math.random().toString(36).substring(7)}`,
			containerId: log.containerId,
			containerName: log.containerName,
			timestamp: log.timestamp.getTime(),
			timestampISO: log.timestamp.toISOString(),
			message: log.message,
			stream: log.stream,
			labels: JSON.stringify(log.labels)
		};

		this.batchBuffer.push(indexedLog);

		if (this.batchBuffer.length >= this.batchSize) {
			await this.flushBatch();
		} else if (!this.batchTimeout) {
			this.batchTimeout = setTimeout(() => this.flushBatch(), this.batchTimeoutMs);
		}
	}

	private async flushBatch(): Promise<void> {
		if (this.batchBuffer.length === 0) return;

		if (this.batchTimeout) {
			clearTimeout(this.batchTimeout);
			this.batchTimeout = null;
		}

		const logsToIndex = [...this.batchBuffer];
		this.batchBuffer = [];

		try {
			await this.index.addDocuments(logsToIndex);
			console.log(`Indexed ${logsToIndex.length} logs`);
		} catch (error) {
			console.error('Error indexing logs batch:', error);
			// Bei Fehler zurück in den Buffer (optional)
			this.batchBuffer.unshift(...logsToIndex);
		}
	}

	async search(
		query: string,
		options: {
			containerName?: string;
			containerId?: string;
			stream?: 'stdout' | 'stderr';
			fromTimestamp?: number;
			toTimestamp?: number;
			limit?: number;
			offset?: number;
		} = {}
	) {
		const filters: string[] = [];

		if (options.containerName) {
			filters.push(`containerName = "${options.containerName}"`);
		}
		if (options.containerId) {
			filters.push(`containerId = "${options.containerId}"`);
		}
		if (options.stream) {
			filters.push(`stream = "${options.stream}"`);
		}
		if (options.fromTimestamp) {
			filters.push(`timestamp >= ${options.fromTimestamp}`);
		}
		if (options.toTimestamp) {
			filters.push(`timestamp <= ${options.toTimestamp}`);
		}

		try {
			const results = await this.index.search(query, {
				filter: filters.length > 0 ? filters.join(' AND ') : undefined,
				limit: options.limit || 100,
				offset: options.offset || 0,
				sort: ['timestamp:desc']
			});

			return {
				hits: results.hits.map((hit) => ({
					...hit,
					labels: JSON.parse((hit as IndexedLog).labels),
					timestamp: new Date((hit as IndexedLog).timestamp)
				})),
				total: results.estimatedTotalHits || 0,
				processingTimeMs: results.processingTimeMs
			};
		} catch (error) {
			console.error('Error searching logs:', error);
			throw error;
		}
	}

	async getContainerList(): Promise<Array<{ name: string; id: string; count: number }>> {
		try {
			// Meilisearch hat keine direkte Aggregation, daher müssen wir alle Dokumente laden
			// und manuell gruppieren (für kleine Datenmengen OK, für große Datenmengen
			// sollte man eine separate Datenbank oder Aggregation verwenden)
			const results = await this.index.search('', {
				limit: 10000,
				attributesToRetrieve: ['containerId', 'containerName']
			});

			// Gruppiere nach containerName statt containerId, da Container-IDs sich bei
			// jedem Neustart ändern können
			const containerMap = new Map<string, { id: string; count: number }>();

			for (const hit of results.hits) {
				const log = hit as IndexedLog;
				const existing = containerMap.get(log.containerName);
				if (existing) {
					existing.count++;
					// Behalte die neueste Container-ID
					existing.id = log.containerId;
				} else {
					containerMap.set(log.containerName, {
						id: log.containerId,
						count: 1
					});
				}
			}

			return Array.from(containerMap.entries()).map(([name, data]) => ({
				id: data.id,
				name,
				count: data.count
			}));
		} catch (error) {
			console.error('Error getting container list:', error);
			return [];
		}
	}

	async getLogHistogram(
		minutes: number = 60,
		containerName?: string
	): Promise<Array<{ minute: string; count: number; timestamp: number }>> {
		try {
			const now = Date.now();
			const fromTimestamp = now - minutes * 60 * 1000;

			const filters: string[] = [`timestamp >= ${fromTimestamp}`];
			if (containerName) {
				filters.push(`containerName = "${containerName}"`);
			}

			const results = await this.index.search('', {
				filter: filters.join(' AND '),
				limit: 100000,
				attributesToRetrieve: ['timestamp']
			});

			// Gruppiere nach Minute
			const minuteMap = new Map<number, number>();

			// Initialisiere alle Minuten mit 0
			for (let i = 0; i < minutes; i++) {
				const minuteTimestamp = Math.floor((now - i * 60 * 1000) / 60000) * 60000;
				minuteMap.set(minuteTimestamp, 0);
			}

			// Zähle Logs pro Minute
			for (const hit of results.hits) {
				const log = hit as IndexedLog;
				const minuteTimestamp = Math.floor(log.timestamp / 60000) * 60000;
				const current = minuteMap.get(minuteTimestamp) || 0;
				minuteMap.set(minuteTimestamp, current + 1);
			}

			// Sortiere nach Zeit und formatiere
			return Array.from(minuteMap.entries())
				.sort((a, b) => a[0] - b[0])
				.map(([timestamp, count]) => {
					const date = new Date(timestamp);
					return {
						minute: date.toLocaleTimeString('de-DE', {
							hour: '2-digit',
							minute: '2-digit'
						}),
						count,
						timestamp
					};
				});
		} catch (error) {
			console.error('Error getting log histogram:', error);
			return [];
		}
	}

	async stop(): Promise<void> {
		await this.flushBatch();
	}
}
