import { json } from '@sveltejs/kit';
import { getNotificationManager } from '$lib/server/notifications/apprise-manager';
import type { AppriseChannel } from '$lib/server/notifications/apprise-manager';
import type { RequestHandler } from './$types';

const notificationManager = getNotificationManager();

/**
 * GET /api/notifications/channels
 * Gibt alle Notification-Channels zurück
 */
export const GET: RequestHandler = async () => {
	try {
		const channels = notificationManager.getAllChannels();
		return json({
			success: true,
			channels
		});
	} catch (error) {
		console.error('Error fetching channels:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

/**
 * POST /api/notifications/channels
 * Erstellt oder aktualisiert einen Notification-Channel
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();
		const channel = data as Omit<AppriseChannel, 'createdAt' | 'updatedAt'>;

		// Validierung
		if (!channel.id || !channel.name || !channel.url) {
			return json(
				{
					success: false,
					error: 'Missing required fields: id, name, url'
				},
				{ status: 400 }
			);
		}

		// Validiere Apprise URL
		const validation = await notificationManager.validateUrl(channel.url);
		if (!validation.valid) {
			return json(
				{
					success: false,
					error: validation.error || 'Invalid Apprise URL'
				},
				{ status: 400 }
			);
		}

		notificationManager.addOrUpdateChannel(channel);

		return json({
			success: true,
			message: 'Channel saved successfully',
			channel
		});
	} catch (error) {
		console.error('Error saving channel:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

/**
 * DELETE /api/notifications/channels
 * Löscht einen Notification-Channel
 */
export const DELETE: RequestHandler = async ({ url }) => {
	try {
		const channelId = url.searchParams.get('id');

		if (!channelId) {
			return json(
				{
					success: false,
					error: 'Missing channel id'
				},
				{ status: 400 }
			);
		}

		const deleted = notificationManager.removeChannel(channelId);

		if (!deleted) {
			return json(
				{
					success: false,
					error: 'Channel not found'
				},
				{ status: 404 }
			);
		}

		return json({
			success: true,
			message: 'Channel deleted successfully'
		});
	} catch (error) {
		console.error('Error deleting channel:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
