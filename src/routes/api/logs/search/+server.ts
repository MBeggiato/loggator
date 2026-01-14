import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getLogAggregatorService } from '$lib/server/log-aggregator';

export const GET: RequestHandler = async ({ url }) => {
	const service = getLogAggregatorService();
	const indexer = service.getIndexer();

	if (!indexer) {
		return json({ error: 'Service not initialized' }, { status: 503 });
	}

	const query = url.searchParams.get('q') || '';
	const containerName = url.searchParams.get('container') || undefined;
	const containerId = url.searchParams.get('containerId') || undefined;
	const stream = (url.searchParams.get('stream') as 'stdout' | 'stderr') || undefined;
	const from = url.searchParams.get('from') ? parseInt(url.searchParams.get('from')!) : undefined;
	const to = url.searchParams.get('to') ? parseInt(url.searchParams.get('to')!) : undefined;
	const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 100;
	const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : 0;

	try {
		const results = await indexer.search(query, {
			containerName,
			containerId,
			stream,
			fromTimestamp: from,
			toTimestamp: to,
			limit,
			offset
		});

		return json(results);
	} catch (error) {
		console.error('Search error:', error);
		return json({ error: 'Search failed', message: String(error) }, { status: 500 });
	}
};
