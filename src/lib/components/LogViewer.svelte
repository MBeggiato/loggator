<script lang="ts">
	interface LogHit {
		id: string;
		containerId: string;
		containerName: string;
		timestamp: number;
		timestampISO: string;
		message: string;
		stream: 'stdout' | 'stderr';
		labels: Record<string, string>;
	}

	interface SearchResults {
		hits: LogHit[];
		total: number;
		processingTimeMs: number;
	}

	interface Container {
		id: string;
		name: string;
		count: number;
	}

	let searchQuery = $state('');
	let selectedContainer = $state('');
	let selectedStream = $state('');
	let containers = $state<Container[]>([]);
	let logs = $state<LogHit[]>([]);
	let isLoading = $state(false);
	let totalResults = $state(0);
	let processingTime = $state(0);
	let errorMessage = $state('');

	// Auto-refresh
	let autoRefresh = $state(true);
	let refreshInterval = $state<NodeJS.Timeout | null>(null);

	async function loadContainers() {
		try {
			const response = await fetch('/api/logs/containers');
			if (!response.ok) throw new Error('Failed to load containers');
			const data = await response.json();
			containers = data.containers;
		} catch (error) {
			console.error('Error loading containers:', error);
		}
	}

	async function searchLogs() {
		isLoading = true;
		errorMessage = '';

		try {
			const params = new URLSearchParams();
			if (searchQuery) params.set('q', searchQuery);
			if (selectedContainer) params.set('container', selectedContainer);
			if (selectedStream) params.set('stream', selectedStream);
			params.set('limit', '200');

			const response = await fetch(`/api/logs/search?${params}`);
			if (!response.ok) throw new Error('Search failed');

			const data: SearchResults = await response.json();
			logs = data.hits;
			totalResults = data.total;
			processingTime = data.processingTimeMs;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error('Search error:', error);
		} finally {
			isLoading = false;
		}
	}

	function formatTimestamp(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	function clearFilters() {
		searchQuery = '';
		selectedContainer = '';
		selectedStream = '';
		searchLogs();
	}

	$effect(() => {
		loadContainers();
		searchLogs();
	});

	$effect(() => {
		if (autoRefresh) {
			refreshInterval = setInterval(() => {
				searchLogs();
			}, 5000);
		} else if (refreshInterval) {
			clearInterval(refreshInterval);
			refreshInterval = null;
		}

		return () => {
			if (refreshInterval) clearInterval(refreshInterval);
		};
	});
</script>

<div class="log-viewer">
	<div class="controls">
		<div class="search-bar">
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Logs durchsuchen..."
				onkeydown={(e) => e.key === 'Enter' && searchLogs()}
			/>
			<button onclick={searchLogs} disabled={isLoading}>
				{isLoading ? '🔄' : '🔍'} Suchen
			</button>
		</div>

		<div class="filters">
			<select bind:value={selectedContainer} onchange={searchLogs}>
				<option value="">Alle Container</option>
				{#each containers as container}
					<option value={container.name}>
						{container.name} ({container.count})
					</option>
				{/each}
			</select>

			<select bind:value={selectedStream} onchange={searchLogs}>
				<option value="">Alle Streams</option>
				<option value="stdout">stdout</option>
				<option value="stderr">stderr</option>
			</select>

			<button onclick={clearFilters} class="clear-btn">✕ Filter zurücksetzen</button>

			<label class="auto-refresh">
				<input type="checkbox" bind:checked={autoRefresh} />
				Auto-Refresh (5s)
			</label>
		</div>

		<div class="stats">
			<span>📊 {totalResults} Ergebnisse</span>
			<span>⚡ {processingTime}ms</span>
		</div>
	</div>

	{#if errorMessage}
		<div class="error">
			❌ Fehler: {errorMessage}
		</div>
	{/if}

	<div class="log-container">
		{#if logs.length === 0 && !isLoading}
			<div class="empty-state">
				<p>Keine Logs gefunden</p>
				<small>Container mit Label <code>loggator.enable=true</code> werden überwacht</small>
			</div>
		{:else}
			{#each logs as log (log.id)}
				<div class="log-entry {log.stream}">
					<span class="timestamp">{formatTimestamp(log.timestamp)}</span>
					<span class="container" title={log.containerId}>{log.containerName}</span>
					<span class="stream-badge {log.stream}">{log.stream}</span>
					<span class="message">{log.message}</span>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.log-viewer {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.controls {
		background: #161b22;
		padding: 1.5rem;
		border-radius: 8px;
		border: 1px solid #30363d;
	}

	.search-bar {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	input[type='text'] {
		flex: 1;
		padding: 0.75rem;
		background: #0d1117;
		border: 1px solid #30363d;
		border-radius: 6px;
		color: #c9d1d9;
		font-size: 1rem;
	}

	input[type='text']:focus {
		outline: none;
		border-color: #58a6ff;
	}

	button {
		padding: 0.75rem 1.5rem;
		background: #238636;
		border: none;
		border-radius: 6px;
		color: white;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}

	button:hover:not(:disabled) {
		background: #2ea043;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.filters {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		align-items: center;
		margin-bottom: 1rem;
	}

	select {
		padding: 0.5rem;
		background: #0d1117;
		border: 1px solid #30363d;
		border-radius: 6px;
		color: #c9d1d9;
		cursor: pointer;
	}

	.clear-btn {
		background: #21262d;
		padding: 0.5rem 1rem;
	}

	.clear-btn:hover {
		background: #30363d;
	}

	.auto-refresh {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		margin-left: auto;
	}

	.stats {
		display: flex;
		gap: 1rem;
		color: #8b949e;
		font-size: 0.9rem;
	}

	.log-container {
		background: #0d1117;
		border: 1px solid #30363d;
		border-radius: 8px;
		max-height: 70vh;
		overflow-y: auto;
		font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
		font-size: 0.9rem;
	}

	.log-entry {
		display: grid;
		grid-template-columns: 180px 200px 80px 1fr;
		gap: 1rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #21262d;
		align-items: baseline;
	}

	.log-entry:hover {
		background: #161b22;
	}

	.log-entry.stderr {
		background: rgba(248, 81, 73, 0.05);
	}

	.timestamp {
		color: #8b949e;
		white-space: nowrap;
	}

	.container {
		color: #58a6ff;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.stream-badge {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 600;
		text-align: center;
		text-transform: uppercase;
	}

	.stream-badge.stdout {
		background: rgba(63, 185, 80, 0.2);
		color: #3fb950;
	}

	.stream-badge.stderr {
		background: rgba(248, 81, 73, 0.2);
		color: #f85149;
	}

	.message {
		color: #c9d1d9;
		word-break: break-word;
	}

	.error {
		background: rgba(248, 81, 73, 0.1);
		border: 1px solid #f85149;
		color: #f85149;
		padding: 1rem;
		border-radius: 6px;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		color: #8b949e;
	}

	.empty-state code {
		background: #161b22;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		color: #58a6ff;
	}

	::-webkit-scrollbar {
		width: 10px;
	}

	::-webkit-scrollbar-track {
		background: #0d1117;
	}

	::-webkit-scrollbar-thumb {
		background: #30363d;
		border-radius: 5px;
	}

	::-webkit-scrollbar-thumb:hover {
		background: #484f58;
	}
</style>
