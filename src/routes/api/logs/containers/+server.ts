import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getLogAggregatorService } from '$lib/server/log-aggregator';

export const GET: RequestHandler = async () => {
	const service = getLogAggregatorService();
	const indexer = service.getIndexer();

	if (!indexer) {
		return json({ error: 'Service not initialized' }, { status: 503 });
	}

	try {
		const [containers, totalCount] = await Promise.all([
			indexer.getContainerList(),
			indexer.getTotalLogCount()
		]);
		return json({ containers, totalCount });
	} catch (error) {
		console.error('Error getting containers:', error);
		return json({ error: 'Failed to get containers', message: String(error) }, { status: 500 });
	}
};
