import { DockerLogCollector } from './docker-collector';
import { MeilisearchIndexer } from './meilisearch-indexer';
import { getErrorDetector } from './error-detector';
import { getNotificationManager } from './notifications/apprise-manager';
import { env } from '$env/dynamic/private';

export class LogAggregatorService {
	private collector: DockerLogCollector | null = null;
	private indexer: MeilisearchIndexer | null = null;
	private errorDetector = getErrorDetector();
	private notificationManager = getNotificationManager();
	private isRunning = false;

	async start(): Promise<void> {
		if (this.isRunning) {
			console.log('Service already running');
			return;
		}

		console.log('Starting Log Aggregator Service...');

		try {
			// Meilisearch Indexer initialisieren
			const meilisearchHost = env.MEILISEARCH_HOST || 'http://localhost:7700';
			const meilisearchKey = env.MEILISEARCH_API_KEY || '';

			this.indexer = new MeilisearchIndexer(meilisearchHost, meilisearchKey);
			await this.indexer.initialize();

			// Docker Log Collector initialisieren mit Error Detection
			const labelFilter = env.DOCKER_LABEL_FILTER || 'loggator.enable=true';
			this.collector = new DockerLogCollector(labelFilter, async (log) => {
				// Log indexieren
				if (this.indexer) {
					await this.indexer.indexLog(log);
				}

				// Error Detection
				const detectedError = this.errorDetector.detectError(log);
				if (detectedError) {
					const shouldNotify = this.errorDetector.addError(detectedError);

					if (shouldNotify) {
						// Hole alle Errors für diesen Container und Severity
						const recentErrors = this.errorDetector.getRecentErrors(
							log.containerId,
							detectedError.severity
						);

						// Sende Benachrichtigung asynchron (blockiert nicht)
						this.notificationManager
							.notifyErrors(recentErrors)
							.catch((error) => {
								console.error('Error sending notification:', error);
							})
							.finally(() => {
								// Bereinige Errors nach Benachrichtigung
								this.errorDetector.clearErrors(log.containerId, detectedError.severity);
							});
					}
				}
			});

			await this.collector.start();

			this.isRunning = true;
			console.log('Log Aggregator Service started successfully');
			console.log('Error detection and notifications enabled');
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
