export default {
	// Common
	common: {
		loading: 'Loading...',
		error: 'Error',
		unknownError: 'Unknown error',
		refresh: 'Refresh',
		search: 'Search',
		filter: 'Filter',
		clear: 'Clear',
		all: 'All',
		save: 'Save',
		cancel: 'Cancel',
		close: 'Close',
		results: 'results',
		entries: 'entries',
		version: 'Version',
		updateAvailable: 'Update available',
		language: 'Language'
	},

	// Navigation
	nav: {
		overview: 'Overview',
		containers: 'Containers',
		logSearch: 'Log Search',
		liveLogs: 'Live Logs',
		collapse: 'Collapse',
		expand: 'Expand'
	},

	// Dashboard
	dashboard: {
		title: 'Dashboard',
		subtitle: 'Overview of your Docker containers and logs',
		totalContainers: 'Total containers',
		totalContainersDesc: 'With label loggator.enable=true',
		active: 'Active',
		activeDesc: 'Containers running',
		stopped: 'Stopped',
		stoppedDesc: 'Containers inactive',
		logsIndexed: 'Logs indexed',
		logsIndexedDesc: 'Entries in Meilisearch',
		logActivity: 'Log Activity',
		logActivityDesc: 'Number of logs per minute',
		allContainers: 'All containers',
		logs: 'Logs',
		containerStatus: 'Container Status',
		containerStatusDesc: 'All monitored containers and their current status',
		noContainersFound: 'No containers with label',
		noContainersFoundSuffix: 'found',
		viewLogs: 'View logs',
		// Time ranges
		minutes30: '30 minutes',
		hour1: '1 hour',
		hours2: '2 hours',
		hours6: '6 hours'
	},

	// Containers page
	containers: {
		title: 'Containers',
		subtitle: 'Manage your monitored Docker containers',
		containerList: 'Container List',
		containerListDesc: 'All containers with the label',
		noContainersFound: 'No containers found',
		addLabelHint: 'Add the label',
		addLabelHintSuffix: 'to your containers',
		start: 'Start',
		stop: 'Stop',
		viewLogs: 'View logs',
		containerStarted: 'Container started',
		containerStartedDesc: 'was started successfully',
		containerStopped: 'Container stopped',
		containerStoppedDesc: 'was stopped successfully',
		errorLoading: 'Error loading containers',
		errorStarting: 'Error starting',
		errorStopping: 'Error stopping'
	},

	// Search page
	search: {
		title: 'Log Search',
		subtitle: 'Search all container logs with full-text search',
		searchFilters: 'Search Filters',
		searchFiltersDesc: 'Search for logs with various filter options',
		searchPlaceholder: 'Search in logs...',
		allContainers: 'All containers',
		allStreams: 'All streams',
		clearFilters: 'Clear filters',
		searchResults: 'Search Results',
		showingResults: 'of',
		entriesShown: 'entries shown',
		noLogsFound: 'No logs found',
		containerLabel: 'Containers with label',
		monitored: 'are monitored',
		searchFailed: 'Search failed'
	},

	// Live logs page
	live: {
		title: 'Live Logs',
		subtitle: 'Real-time log stream of all monitored containers',
		resume: 'Resume',
		pause: 'Pause',
		clear: 'Clear',
		autoScroll: 'Auto-Scroll',
		live: 'Live',
		paused: 'Paused',
		logOutput: 'Log Output',
		waitingForLogs: 'Waiting for logs...',
		couldNotLoad: 'Could not load logs'
	},

	// AI Chat
	chat: {
		title: 'AI Log Assistant',
		subtitle: 'Ask questions about your container logs',
		inputPlaceholder: 'Ask something about your logs...',
		send: 'Send',
		thinking: 'AI is analyzing...',
		emptyState: 'Ask a question about your container logs',
		suggestion1: 'Show me all errors from the last hour',
		suggestion2: 'Which containers are currently running?',
		suggestion3: 'What happened to the nginx container?',
		clearHistory: 'Clear history',
		clearConfirm: 'Really clear chat history?',
		historyCleared: 'Chat history cleared',
		error: 'Error sending message',
		networkError: 'Network error. Please try again.',
		openChat: 'Open AI assistant',
		closeChat: 'Close chat'
	},

	// Toasts & Notifications
	toast: {
		success: 'Success',
		error: 'Error',
		warning: 'Warning',
		info: 'Info'
	}
} as const;
