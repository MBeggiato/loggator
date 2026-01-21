export default {
	// Common
	common: {
		loading: 'Laden...',
		error: 'Fehler',
		unknownError: 'Unbekannter Fehler',
		refresh: 'Aktualisieren',
		search: 'Suchen',
		filter: 'Filter',
		clear: 'Löschen',
		all: 'Alle',
		save: 'Speichern',
		cancel: 'Abbrechen',
		close: 'Schließen',
		results: 'Ergebnisse',
		entries: 'Einträge',
		version: 'Version',
		updateAvailable: 'Update verfügbar',
		language: 'Sprache'
	},

	// Navigation
	nav: {
		overview: 'Übersicht',
		containers: 'Container',
		logSearch: 'Log-Suche',
		liveLogs: 'Live-Logs',
		notifications: 'Benachrichtigungen',
		collapse: 'Einklappen',
		expand: 'Ausklappen'
	},

	// Dashboard
	dashboard: {
		title: 'Dashboard',
		subtitle: 'Übersicht über deine Docker-Container und Logs',
		totalContainers: 'Container gesamt',
		totalContainersDesc: 'Mit Label loggator.enable=true',
		active: 'Aktiv',
		activeDesc: 'Container laufen',
		stopped: 'Gestoppt',
		stoppedDesc: 'Container inaktiv',
		logsIndexed: 'Logs indiziert',
		logsIndexedDesc: 'Einträge in Meilisearch',
		logActivity: 'Log-Aktivität',
		logActivityDesc: 'Anzahl der Logs pro Minute',
		allContainers: 'Alle Container',
		logs: 'Logs',
		containerStatus: 'Container-Status',
		containerStatusDesc: 'Alle überwachten Container und ihr aktueller Status',
		noContainersFound: 'Keine Container mit Label',
		noContainersFoundSuffix: 'gefunden',
		viewLogs: 'Logs anzeigen',
		// Time ranges
		minutes30: '30 Minuten',
		hour1: '1 Stunde',
		hours2: '2 Stunden',
		hours6: '6 Stunden'
	},

	// Containers page
	containers: {
		title: 'Container',
		subtitle: 'Verwalte deine überwachten Docker-Container',
		containerList: 'Container-Liste',
		containerListDesc: 'Alle Container mit dem Label',
		noContainersFound: 'Keine Container gefunden',
		addLabelHint: 'Füge deinen Containern das Label',
		addLabelHintSuffix: 'hinzu',
		start: 'Starten',
		stop: 'Stoppen',
		viewLogs: 'Logs anzeigen',
		containerStarted: 'Container gestartet',
		containerStartedDesc: 'wurde erfolgreich gestartet',
		containerStopped: 'Container gestoppt',
		containerStoppedDesc: 'wurde erfolgreich gestoppt',
		errorLoading: 'Fehler beim Laden der Container',
		errorStarting: 'Fehler beim Starten',
		errorStopping: 'Fehler beim Stoppen'
	},

	// Search page
	search: {
		title: 'Log-Suche',
		subtitle: 'Durchsuche alle Container-Logs mit Volltextsuche',
		searchFilters: 'Suchfilter',
		searchFiltersDesc: 'Suche nach Logs mit verschiedenen Filteroptionen',
		searchPlaceholder: 'Suche in Logs...',
		allContainers: 'Alle Container',
		allStreams: 'Alle Streams',
		clearFilters: 'Filter zurücksetzen',
		searchResults: 'Suchergebnisse',
		showingResults: 'von',
		entriesShown: 'Einträgen angezeigt',
		noLogsFound: 'Keine Logs gefunden',
		containerLabel: 'Container mit Label',
		monitored: 'werden überwacht',
		searchFailed: 'Suche fehlgeschlagen'
	},

	// Live logs page
	live: {
		title: 'Live-Logs',
		subtitle: 'Echtzeit-Log-Stream aller überwachten Container',
		resume: 'Fortsetzen',
		pause: 'Pausieren',
		clear: 'Leeren',
		autoScroll: 'Auto-Scroll',
		live: 'Live',
		paused: 'Pausiert',
		logOutput: 'Log-Ausgabe',
		waitingForLogs: 'Warte auf Logs...',
		couldNotLoad: 'Logs konnten nicht geladen werden'
	},

	// AI Chat
	chat: {
		title: 'KI Log-Assistent',
		subtitle: 'Stellen Sie Fragen zu Ihren Container-Logs',
		inputPlaceholder: 'Fragen Sie etwas über Ihre Logs...',
		send: 'Senden',
		thinking: 'KI analysiert...',
		emptyState: 'Stellen Sie eine Frage zu Ihren Container-Logs',
		suggestion1: 'Zeige mir alle Fehler der letzten Stunde',
		suggestion2: 'Welche Container laufen gerade?',
		suggestion3: 'Was ist mit dem nginx Container passiert?',
		clearHistory: 'Verlauf löschen',
		clearConfirm: 'Chat-Verlauf wirklich löschen?',
		historyCleared: 'Chat-Verlauf gelöscht',
		error: 'Fehler beim Senden der Nachricht',
		networkError: 'Netzwerkfehler. Bitte versuchen Sie es erneut.',
		openChat: 'KI-Assistent öffnen',
		closeChat: 'Chat schließen'
	},

	// Toasts & Notifications
	toast: {
		success: 'Erfolg',
		error: 'Fehler',
		warning: 'Warnung',
		info: 'Info'
	}
} as const;
