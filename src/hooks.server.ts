import { getLogAggregatorService } from '$lib/server/log-aggregator';

// Service beim App-Start initialisieren
const service = getLogAggregatorService();

service.start().catch((error) => {
	console.error('Failed to start log aggregator service:', error);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
	console.log('SIGTERM received, shutting down gracefully...');
	await service.stop();
	process.exit(0);
});

process.on('SIGINT', async () => {
	console.log('SIGINT received, shutting down gracefully...');
	await service.stop();
	process.exit(0);
});

export async function handle({ event, resolve }) {
	return resolve(event);
}
