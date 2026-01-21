import { json } from '@sveltejs/kit';
import { getErrorDetector } from '$lib/server/error-detector';
import type { RequestHandler } from './$types';

const errorDetector = getErrorDetector();

/**
 * GET /api/notifications/settings
 * Gibt die aktuellen Notification-Einstellungen zurück
 */
export const GET: RequestHandler = async () => {
	try {
		// Hier könnten wir die aktuellen Schwellwerte und Patterns zurückgeben
		return json({
			success: true,
			settings: {
				providers: ['email', 'slack', 'discord', 'webhook', 'telegram', 'msteams'],
				severities: ['low', 'medium', 'high', 'critical']
			}
		});
	} catch (error) {
		console.error('Error fetching settings:', error);
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
 * POST /api/notifications/settings/thresholds
 * Aktualisiert Error-Schwellwerte
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { thresholds, timeWindows } = await request.json();

		if (thresholds) {
			errorDetector.updateThresholds(thresholds);
		}

		if (timeWindows) {
			errorDetector.updateTimeWindows(timeWindows);
		}

		return json({
			success: true,
			message: 'Settings updated successfully'
		});
	} catch (error) {
		console.error('Error updating settings:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
