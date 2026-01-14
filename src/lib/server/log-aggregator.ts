import { DockerLogCollector } from './docker-collector';
import { MeilisearchIndexer } from './meilisearch-indexer';

export class LogAggregatorService {
	private collector: DockerLogCollector | null = null;
	private indexer: MeilisearchIndexer | null = null;
	private isRunning = false;

	async start(): Promise<void> {
		if (this.isRunning) {
			console.log('Service already running');
			return;
		}

		console.log('Starting Log Aggregator Service...');

		try {
			// Meilisearch Indexer initialisieren
			const meilisearchHost = process.env.MEILISEARCH_HOST || 'http://meilisearch:7700';
			const meilisearchKey = process.env.MEILISEARCH_API_KEY || '';

			this.indexer = new MeilisearchIndexer(meilisearchHost, meilisearchKey);
			await this.indexer.initialize();

			// Docker Log Collector initialisieren
			const labelFilter = process.env.DOCKER_LABEL_FILTER || 'loggator.enable=true';
			this.collector = new DockerLogCollector(labelFilter, async (log) => {
				if (this.indexer) {
					await this.indexer.indexLog(log);
				}
			});

			await this.collector.start();

			this.isRunning = true;
			console.log('Log Aggregator Service started successfully');
		} catch (error) {
			console.error('Error starting service:', error);
			await this.stop();
			throw error;
		}
	}

	async stop(): Promise<void> {
		console.log('Stopping Log Aggregator Service...');

		if (this.collector) {
			this.collector.stop();
			this.collector = null;
		}

		if (this.indexer) {
			await this.indexer.stop();
			this.indexer = null;
		}

		this.isRunning = false;
		console.log('Log Aggregator Service stopped');
	}

	getIndexer(): MeilisearchIndexer | null {
		return this.indexer;
	}

	isServiceRunning(): boolean {
		return this.isRunning;
	}
}

// Singleton-Instanz
let serviceInstance: LogAggregatorService | null = null;

export function getLogAggregatorService(): LogAggregatorService {
	if (!serviceInstance) {
		serviceInstance = new LogAggregatorService();
	}
	return serviceInstance;
}
