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

	// SECURITY: Validate and limit parameters
	const limitParam = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 100;
	const limit = Math.max(1, Math.min(limitParam, 1000)); // Limit between 1-1000
	const offsetParam = url.searchParams.get('offset')
		? parseInt(url.searchParams.get('offset')!)
		: 0;
	const offset = Math.max(0, Math.min(offsetParam, 100000)); // Max offset 100k

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
