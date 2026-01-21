import type { ErrorSummary } from '../ai-summary';
import { getAISummaryService } from '../ai-summary';
import type { DetectedError } from '../error-detector';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const CHANNELS_FILE = join(process.cwd(), 'notification-channels.json');
const APPRISE_API_URL = process.env.APPRISE_API_URL || 'http://apprise:8000';

export interface AppriseChannel {
	id: string;
	name: string;
	url: string; // Apprise URL (z.B. slack://webhook, discord://webhook, mailto://...)
	enabled: boolean;
	filters: {
		containers?: string[]; // Container-Namen oder Patterns
		minSeverity?: 'low' | 'medium' | 'high' | 'critical';
	};
	createdAt: Date;
	updatedAt: Date;
}

export interface AppriseNotifyRequest {
	urls: string | string[];
	title?: string;
	body: string;
	type?: 'info' | 'success' | 'warning' | 'failure';
	format?: 'text' | 'markdown' | 'html';
	tag?: string | string[];
	attach?: string | string[];
}

/**
 * Vereinfachter Notification Manager mit Apprise
 */
export class AppriseNotificationManager {
	private channels: Map<string, AppriseChannel> = new Map();
	private aiSummaryService = getAISummaryService();

	// Tracking für gesendete Notifications (Prevent spam)
	private sentNotifications: Map<string, Date> = new Map();
	private cooldownMinutes = 15;

	constructor() {
		this.loadChannels();
	}

	/**
	 * Lädt Channels aus der Datei
	 */
	private loadChannels(): void {
		if (!existsSync(CHANNELS_FILE)) {
			this.saveChannels();
			return;
		}

		try {
			const data = readFileSync(CHANNELS_FILE, 'utf-8');
			const parsed = JSON.parse(data);
			this.channels = new Map(Object.entries(parsed));
		} catch (error) {
			console.error('Error loading notification channels:', error);
		}
	}

	/**
	 * Speichert Channels in die Datei
	 */
	private saveChannels(): void {
		try {
			const obj = Object.fromEntries(this.channels);
			writeFileSync(CHANNELS_FILE, JSON.stringify(obj, null, 2));
		} catch (error) {
			console.error('Error saving notification channels:', error);
		}
	}

	/**
	 * Sendet Notifications für erkannte Fehler
	 */
	async notifyErrors(errors: DetectedError[]): Promise<void> {
		if (errors.length === 0) return;

		// Generiere AI Summary für die Fehler
		const summary = await this.aiSummaryService.generateErrorSummary(errors);

		// Finde passende Channels
		const channels = this.findMatchingChannels(errors);

		if (channels.length === 0) {
			console.log('No matching notification channels found');
			return;
		}

		// Sende Notifications
		for (const channel of channels) {
			await this.sendNotification(channel, summary, errors);
		}
	}

	/**
	 * Findet Channels, die zu den Errors passen
	 */
	private findMatchingChannels(errors: DetectedError[]): AppriseChannel[] {
		const matching: AppriseChannel[] = [];

		for (const channel of this.channels.values()) {
			if (!channel.enabled) continue;

			// Prüfe, ob mindestens ein Error den Filter-Kriterien entspricht
			const hasMatch = errors.some((error) => {
				// Container-Filter
				if (channel.filters.containers && channel.filters.containers.length > 0) {
					const matches = channel.filters.containers.some((pattern) => {
						if (pattern.includes('*')) {
							const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
							return regex.test(error.containerName);
						}
						return error.containerName === pattern;
					});
					if (!matches) return false;
				}

				// Severity-Filter
				if (channel.filters.minSeverity) {
					const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
					const errorSeverity = severityOrder[error.severity];
					const minSeverity = severityOrder[channel.filters.minSeverity];
					if (errorSeverity < minSeverity) return false;
				}

				return true;
			});

			if (hasMatch) {
				matching.push(channel);
			}
		}

		return matching;
	}

	/**
	 * Sendet eine Notification über Apprise
	 */
	private async sendNotification(
		channel: AppriseChannel,
		summary: ErrorSummary,
		errors: DetectedError[]
	): Promise<void> {
		// Cooldown Check
		const notificationKey = `${channel.id}-${summary.errorHash}`;
		const lastSent = this.sentNotifications.get(notificationKey);
		if (lastSent) {
			const minutesSinceLastSent = (Date.now() - lastSent.getTime()) / 1000 / 60;
			if (minutesSinceLastSent < this.cooldownMinutes) {
				console.log(
					`Skipping notification to ${channel.name} (cooldown: ${minutesSinceLastSent.toFixed(1)}/${this.cooldownMinutes} min)`
				);
				return;
			}
		}

		try {
			// Formatiere die Nachricht
			const body = this.formatNotificationBody(summary, errors);

			// Apprise Severity Mapping
			const typeMap = {
				low: 'info',
				medium: 'warning',
				high: 'warning',
				critical: 'failure'
			} as const;

			const request: AppriseNotifyRequest = {
				urls: channel.url,
				title: summary.title,
				body: body,
				type: typeMap[summary.severity],
				format: 'markdown'
			};

			// Sende über Apprise API
			const response = await fetch(`${APPRISE_API_URL}/notify`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(request)
			});

			if (!response.ok) {
				const error = await response.text();
				throw new Error(`Apprise API error: ${response.status} - ${error}`);
			}

			// Markiere als gesendet
			this.sentNotifications.set(notificationKey, new Date());
			console.log(`✓ Notification sent to ${channel.name}`);
		} catch (error) {
			console.error(`Error sending notification to ${channel.name}:`, error);
		}
	}

	/**
	 * Formatiert den Notification Body
	 */
	private formatNotificationBody(summary: ErrorSummary, errors: DetectedError[]): string {
		const emoji = { low: '💡', medium: '⚠️', high: '🔴', critical: '🚨' }[summary.severity];

		let body = `${emoji} **${summary.severity.toUpperCase()}**\n\n`;
		body += `**Problem:**\n${summary.summary}\n\n`;

		if (summary.solution) {
			body += `**Lösung:**\n${summary.solution}\n\n`;
		}

		// Affected Containers
		const containers = [...new Set(errors.map((e) => e.containerName))];
		body += `**Betroffene Container:** ${containers.join(', ')}\n`;
		body += `**Fehleranzahl:** ${errors.length}\n`;

		// Zeitraum
		const firstError = errors[0];
		const lastError = errors[errors.length - 1];
		body += `**Zeitraum:** ${new Date(firstError.timestamp).toLocaleString('de-DE')} - ${new Date(lastError.timestamp).toLocaleString('de-DE')}\n`;

		return body;
	}

	/**
	 * Fügt einen neuen Channel hinzu oder aktualisiert einen existierenden
	 */
	addOrUpdateChannel(channel: Omit<AppriseChannel, 'createdAt' | 'updatedAt'>): void {
		const existing = this.channels.get(channel.id);
		const now = new Date();

		const updatedChannel: AppriseChannel = {
			...channel,
			createdAt: existing?.createdAt || now,
			updatedAt: now
		};

		this.channels.set(channel.id, updatedChannel);
		this.saveChannels();
	}

	/**
	 * Entfernt einen Channel
	 */
	removeChannel(id: string): boolean {
		const deleted = this.channels.delete(id);
		if (deleted) {
			this.saveChannels();
		}
		return deleted;
	}

	/**
	 * Gibt alle Channels zurück
	 */
	getAllChannels(): AppriseChannel[] {
		return Array.from(this.channels.values());
	}

	/**
	 * Testet einen Channel durch Senden einer Test-Notification
	 */
	async testChannel(channelId: string): Promise<boolean> {
		const channel = this.channels.get(channelId);
		if (!channel) {
			throw new Error('Channel not found');
		}

		const testSummary: ErrorSummary = {
			title: '🧪 Test Notification',
			summary: 'Dies ist eine Test-Benachrichtigung von Loggator.',
			solution: 'Wenn Sie diese Nachricht erhalten, funktioniert Ihr Notification-Channel korrekt!',
			severity: 'low',
			errorHash: 'test-' + Date.now(),
			timestamp: new Date(),
			affectedContainers: ['test-container']
		};

		const testError: DetectedError = {
			pattern: 'test',
			severity: 'low',
			message: 'Test-Nachricht',
			containerName: 'test-container',
			timestamp: Date.now(),
			logEntry: {
				id: 'test',
				container_id: 'test',
				container_name: 'test-container',
				timestamp: Date.now(),
				message: 'Test',
				stream: 'stdout',
				indexed_at: Date.now()
			}
		};

		try {
			// Temporär Cooldown deaktivieren für Test
			const originalCooldown = this.cooldownMinutes;
			this.cooldownMinutes = 0;

			await this.sendNotification(channel, testSummary, [testError]);

			this.cooldownMinutes = originalCooldown;
			return true;
		} catch (error) {
			console.error('Test notification failed:', error);
			return false;
		}
	}

	/**
	 * Validiert eine Apprise URL
	 */
	async validateUrl(url: string): Promise<{ valid: boolean; error?: string }> {
		try {
			// Teste, ob die URL das richtige Format hat
			if (!url.includes('://')) {
				return { valid: false, error: 'Ungültiges URL-Format. Erwartet: schema://...' };
			}

			// Sende Test-Request an Apprise (mit dry_run)
			const response = await fetch(`${APPRISE_API_URL}/notify`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					urls: url,
					title: 'Validation Test',
					body: 'Test'
				})
			});

			if (!response.ok) {
				const error = await response.text();
				return { valid: false, error: `Apprise validation failed: ${error}` };
			}

			return { valid: true };
		} catch (error) {
			return { valid: false, error: String(error) };
		}
	}
}

// Singleton Instance
let notificationManager: AppriseNotificationManager | null = null;

export function getNotificationManager(): AppriseNotificationManager {
	if (!notificationManager) {
		notificationManager = new AppriseNotificationManager();
	}
	return notificationManager;
}
