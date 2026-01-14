import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLogAggregatorService } from '$lib/server/log-aggregator';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const aggregator = getLogAggregatorService();
		const indexer = aggregator.getIndexer();

		if (!indexer) {
			return json({ error: 'Indexer not initialized' }, { status: 503 });
		}

		const minutes = parseInt(url.searchParams.get('minutes') || '60', 10);
		const container = url.searchParams.get('container') || undefined;

		const histogram = await indexer.getLogHistogram(minutes, container);

		return json({
			histogram,
			minutes,
			container: container || null
		});
	} catch (error) {
		console.error('Error getting histogram:', error);
		return json({ error: 'Failed to get histogram' }, { status: 500 });
	}
};
