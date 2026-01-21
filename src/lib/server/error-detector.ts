import type { LogEntry } from './docker-collector';

export interface ErrorPattern {
	pattern: RegExp;
	severity: 'low' | 'medium' | 'high' | 'critical';
	description: string;
}

export interface DetectedError {
	log: LogEntry;
	severity: 'low' | 'medium' | 'high' | 'critical';
	matchedPattern: string;
	timestamp: Date;
}

export class ErrorDetector {
	private errorPatterns: ErrorPattern[] = [
		// Kritische Errors
		{
			pattern: /fatal|critical|panic|segfault|out of memory|oom|killed/i,
			severity: 'critical',
			description: 'Critical system error detected'
		},
		{
			pattern: /exception|unhandled|uncaught|stack trace/i,
			severity: 'critical',
			description: 'Unhandled exception detected'
		},
		// Hohe Priorität
		{
			pattern: /error|err|failed|failure|cannot|unable to/i,
			severity: 'high',
			description: 'Error detected'
		},
		{
			pattern: /connection refused|connection timeout|econnrefused|enotfound/i,
			severity: 'high',
			description: 'Connection error detected'
		},
		{
			pattern: /authentication failed|unauthorized|forbidden|access denied/i,
			severity: 'high',
			description: 'Authentication/Authorization error detected'
		},
		// Mittlere Priorität
		{
			pattern: /warning|warn|deprecated/i,
			severity: 'medium',
			description: 'Warning detected'
		},
		{
			pattern: /retry|retrying|timeout/i,
			severity: 'medium',
			description: 'Retry or timeout detected'
		},
		// Niedrige Priorität
		{
			pattern: /notice|info.*error/i,
			severity: 'low',
			description: 'Informational error detected'
		}
	];

	private recentErrors: Map<string, DetectedError[]> = new Map();
	private errorThresholds = {
		critical: 1, // Sofort benachrichtigen
		high: 5, // Nach 5 Errors in 5 Minuten
		medium: 10, // Nach 10 Warnings in 10 Minuten
		low: 20 // Nach 20 in 15 Minuten
	};

	private timeWindows = {
		critical: 0, // Sofort
		high: 5 * 60 * 1000, // 5 Minuten
		medium: 10 * 60 * 1000, // 10 Minuten
		low: 15 * 60 * 1000 // 15 Minuten
	};

	/**
	 * Analysiert einen Log-Eintrag auf Fehler
	 */
	detectError(log: LogEntry): DetectedError | null {
		// Prüfe ob stderr Stream (oft Errors)
		const message = log.message.toLowerCase();

		for (const errorPattern of this.errorPatterns) {
			if (errorPattern.pattern.test(log.message)) {
				return {
					log,
					severity: errorPattern.severity,
					matchedPattern: errorPattern.description,
					timestamp: new Date()
				};
			}
		}

		return null;
	}

	/**
	 * Fügt einen erkannten Fehler hinzu und prüft ob Schwellwert erreicht
	 */
	addError(error: DetectedError): boolean {
		const key = `${error.log.containerId}-${error.severity}`;

		if (!this.recentErrors.has(key)) {
			this.recentErrors.set(key, []);
		}

		const errors = this.recentErrors.get(key)!;
		errors.push(error);

		// Bereinige alte Errors außerhalb des Zeitfensters
		const timeWindow = this.timeWindows[error.severity];
		const now = Date.now();
		const filtered = errors.filter((e) => now - e.timestamp.getTime() <= timeWindow);
		this.recentErrors.set(key, filtered);

		// Prüfe ob Schwellwert erreicht
		const threshold = this.errorThresholds[error.severity];
		return filtered.length >= threshold;
	}

	/**
	 * Hole alle Errors eines Containers im Zeitfenster
	 */
	getRecentErrors(
		containerId: string,
		severity?: 'low' | 'medium' | 'high' | 'critical'
	): DetectedError[] {
		const allErrors: DetectedError[] = [];

		for (const [key, errors] of this.recentErrors.entries()) {
			if (key.startsWith(containerId)) {
				if (!severity || key.endsWith(severity)) {
					allErrors.push(...errors);
				}
			}
		}

		return allErrors.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
	}

	/**
	 * Bereinige Errors eines Containers nach Benachrichtigung
	 */
	clearErrors(containerId: string, severity?: 'low' | 'medium' | 'high' | 'critical'): void {
		if (severity) {
			const key = `${containerId}-${severity}`;
			this.recentErrors.delete(key);
		} else {
			// Lösche alle Severities für den Container
			for (const key of Array.from(this.recentErrors.keys())) {
				if (key.startsWith(containerId)) {
					this.recentErrors.delete(key);
				}
			}
		}
	}

	/**
	 * Füge eigenes Error-Pattern hinzu
	 */
	addCustomPattern(pattern: ErrorPattern): void {
		this.errorPatterns.push(pattern);
	}

	/**
	 * Aktualisiere Schwellwerte
	 */
	updateThresholds(thresholds: Partial<typeof this.errorThresholds>): void {
		this.errorThresholds = { ...this.errorThresholds, ...thresholds };
	}

	/**
	 * Aktualisiere Zeitfenster
	 */
	updateTimeWindows(windows: Partial<typeof this.timeWindows>): void {
		this.timeWindows = { ...this.timeWindows, ...windows };
	}
}

// Singleton-Instanz
let detectorInstance: ErrorDetector | null = null;

export function getErrorDetector(): ErrorDetector {
	if (!detectorInstance) {
		detectorInstance = new ErrorDetector();
	}
	return detectorInstance;
}
