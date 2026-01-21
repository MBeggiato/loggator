import { env } from '$env/dynamic/private';
import type { DetectedError } from './error-detector';

export interface ErrorSummary {
	containerId: string;
	containerName: string;
	severity: 'low' | 'medium' | 'high' | 'critical';
	errorCount: number;
	timeRange: {
		start: Date;
		end: Date;
	};
	summary: string;
	errors: Array<{
		message: string;
		timestamp: Date;
		stream: string;
	}>;
	recommendations?: string[];
}

export class AISummaryService {
	private apiKey: string;
	private model: string;
	private apiUrl = 'https://openrouter.ai/api/v1/chat/completions';

	constructor() {
		this.apiKey = env.OPENROUTER_API_KEY || '';
		this.model = env.AI_MODEL || 'anthropic/claude-3.5-sonnet';
	}

	/**
	 * Generiert eine KI-Zusammenfassung von Errors
	 */
	async generateErrorSummary(errors: DetectedError[]): Promise<ErrorSummary> {
		if (errors.length === 0) {
			throw new Error('No errors to summarize');
		}

		const firstError = errors[0];
		const containerId = firstError.log.containerId;
		const containerName = firstError.log.containerName;
		const severity = this.getHighestSeverity(errors);

		// Zeitbereich ermitteln
		const timestamps = errors.map((e) => e.timestamp.getTime());
		const timeRange = {
			start: new Date(Math.min(...timestamps)),
			end: new Date(Math.max(...timestamps))
		};

		// Fehler-Nachrichten vorbereiten
		const errorMessages = errors
			.slice(0, 20) // Max 20 Errors für die KI
			.map((e) => ({
				message: e.log.message,
				timestamp: e.timestamp,
				stream: e.log.stream
			}));

		// KI-Prompt erstellen
		const prompt = this.createSummaryPrompt(
			containerName,
			severity,
			errorMessages.map((e) => e.message)
		);

		// KI-Zusammenfassung generieren
		let summary = '';
		let recommendations: string[] = [];

		if (this.apiKey) {
			try {
				const aiResponse = await this.callOpenRouter(prompt);
				const parsed = this.parseAIResponse(aiResponse);
				summary = parsed.summary;
				recommendations = parsed.recommendations;
			} catch (error) {
				console.error('Error calling AI service:', error);
				summary = this.generateFallbackSummary(errors);
			}
		} else {
			summary = this.generateFallbackSummary(errors);
		}

		return {
			containerId,
			containerName,
			severity,
			errorCount: errors.length,
			timeRange,
			summary,
			errors: errorMessages,
			recommendations
		};
	}

	/**
	 * Erstellt den Prompt für die KI
	 */
	private createSummaryPrompt(
		containerName: string,
		severity: string,
		errorMessages: string[]
	): string {
		return `Du bist ein Experte für Log-Analyse und Container-Diagnostik.

Analysiere die folgenden Fehler aus dem Container "${containerName}" (Severity: ${severity}):

${errorMessages.map((msg, i) => `${i + 1}. ${msg}`).join('\n')}

Erstelle eine prägnante Zusammenfassung im folgenden Format:

**ZUSAMMENFASSUNG:**
[Eine kurze, klare Beschreibung des Hauptproblems in 2-3 Sätzen]

**URSACHE:**
[Wahrscheinliche Ursache des Problems]

**EMPFEHLUNGEN:**
1. [Konkrete Lösungsvorschläge]
2. [Weitere Maßnahmen]
3. [Präventive Schritte]

Sei präzise und technisch, aber verständlich. Konzentriere dich auf umsetzbare Lösungen.`;
	}

	/**
	 * Ruft die OpenRouter API auf
	 */
	private async callOpenRouter(prompt: string): Promise<string> {
		const response = await fetch(this.apiUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.apiKey}`,
				'HTTP-Referer': env.SITE_URL || 'http://localhost:3000',
				'X-Title': 'Loggator Error Analysis'
			},
			body: JSON.stringify({
				model: this.model,
				messages: [
					{
						role: 'user',
						content: prompt
					}
				],
				temperature: 0.3, // Niedrige Temperatur für konsistente Antworten
				max_tokens: 1000
			})
		});

		if (!response.ok) {
			throw new Error(`OpenRouter API error: ${response.status}`);
		}

		const data = await response.json();
		return data.choices[0]?.message?.content || '';
	}

	/**
	 * Parst die KI-Antwort
	 */
	private parseAIResponse(response: string): { summary: string; recommendations: string[] } {
		// Extrahiere Empfehlungen
		const recommendationsMatch = response.match(/\*\*EMPFEHLUNGEN:\*\*\s*([\s\S]*?)(?:\n\n|$)/);
		let recommendations: string[] = [];

		if (recommendationsMatch) {
			recommendations = recommendationsMatch[1]
				.split('\n')
				.filter((line) => line.match(/^\d+\./))
				.map((line) => line.replace(/^\d+\.\s*/, '').trim());
		}

		return {
			summary: response,
			recommendations
		};
	}

	/**
	 * Generiert eine Fallback-Zusammenfassung ohne KI
	 */
	private generateFallbackSummary(errors: DetectedError[]): string {
		const containerName = errors[0].log.containerName;
		const severity = this.getHighestSeverity(errors);
		const errorCount = errors.length;

		// Gruppiere nach Pattern
		const patternCounts = new Map<string, number>();
		for (const error of errors) {
			const count = patternCounts.get(error.matchedPattern) || 0;
			patternCounts.set(error.matchedPattern, count + 1);
		}

		const topPatterns = Array.from(patternCounts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3)
			.map(([pattern, count]) => `${count}x ${pattern}`)
			.join(', ');

		return `**${errorCount} ${severity.toUpperCase()} Fehler** in Container "${containerName}" erkannt.\n\n**Häufigste Probleme:** ${topPatterns}\n\n**Aktion erforderlich:** Bitte überprüfe die Logs für weitere Details.`;
	}

	/**
	 * Ermittelt die höchste Severity
	 */
	private getHighestSeverity(errors: DetectedError[]): 'low' | 'medium' | 'high' | 'critical' {
		const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
		let highest: 'low' | 'medium' | 'high' | 'critical' = 'low';

		for (const error of errors) {
			if (severityOrder[error.severity] > severityOrder[highest]) {
				highest = error.severity;
			}
		}

		return highest;
	}
}

// Singleton-Instanz
let summaryServiceInstance: AISummaryService | null = null;

export function getAISummaryService(): AISummaryService {
	if (!summaryServiceInstance) {
		summaryServiceInstance = new AISummaryService();
	}
	return summaryServiceInstance;
}
