import { json } from '@sveltejs/kit';
import { getNotificationManager } from '$lib/server/notifications/apprise-manager';
import type { RequestHandler } from './$types';

const notificationManager = getNotificationManager();

/**
 * POST /api/notifications/test
 * Testet einen Notification-Channel
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { channelId } = await request.json();

		if (!channelId) {
			return json(
				{
					success: false,
					error: 'Missing channelId'
				},
				{ status: 400 }
			);
		}

		await notificationManager.testChannel(channelId);

		return json({
			success: true,
			message: 'Test notification sent successfully'
		});
	} catch (error) {
		console.error('Error testing channel:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
