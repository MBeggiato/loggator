import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getLogAggregatorService } from '$lib/server/log-aggregator';

export const GET: RequestHandler = async () => {
	const service = getLogAggregatorService();

	return json({
		running: service.isServiceRunning(),
		status: service.isServiceRunning() ? 'healthy' : 'stopped'
	});
};
