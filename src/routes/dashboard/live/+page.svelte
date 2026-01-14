<script lang="ts">
	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
		Badge,
		Button,
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger
	} from '$lib/components/ui';
	import { Activity, Pause, Play, Trash2, Filter, RefreshCw } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	interface LogHit {
		id: string;
		containerId: string;
		containerName: string;
		timestamp: number;
		timestampISO: string;
		message: string;
		stream: 'stdout' | 'stderr';
	}

	interface Container {
		id: string;
		name: string;
		count: number;
	}

	let logs = $state<LogHit[]>([]);
	let containers = $state<Container[]>([]);
	let selectedContainer = $state<string | undefined>(undefined);
	let selectedStream = $state<string | undefined>(undefined);
	let isPaused = $state(false);
	let isLoading = $state(false);
	let autoScroll = $state(true);
	let refreshInterval: NodeJS.Timeout | null = null;
	let hasShownError = $state(false);

	async function loadContainers() {
		try {
			const response = await fetch('/api/logs/containers');
			if (!response.ok) return;
			const data = await response.json();
			containers = data.containers;
		} catch (error) {
			console.error('Error loading containers:', error);
		}
	}

	async function loadLogs() {
		if (isPaused) return;

		isLoading = true;
		try {
			const params = new URLSearchParams();
			if (selectedContainer) params.set('container', selectedContainer);
			if (selectedStream) params.set('stream', selectedStream);
			params.set('limit', '100');

			const response = await fetch(`/api/logs/search?${params}`);
			if (!response.ok) throw new Error('Failed to load logs');

			const data = await response.json();
			logs = data.hits;
			hasShownError = false;
		} catch (error) {
			// Only show error toast once to avoid spam during auto-refresh
			if (!hasShownError) {
				toast.error('Logs konnten nicht geladen werden', {
					description: error instanceof Error ? error.message : 'Unbekannter Fehler'
				});
				hasShownError = true;
			}
			console.error('Error loading logs:', error);
		} finally {
			isLoading = false;
		}
	}

	function formatTimestamp(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleString('de-DE', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			fractionalSecondDigits: 3
		});
	}

	function clearLogs() {
		logs = [];
	}

	function togglePause() {
		isPaused = !isPaused;
		if (!isPaused) {
			loadLogs();
		}
	}

	$effect(() => {
		loadContainers();
		loadLogs();

		refreshInterval = setInterval(loadLogs, 2000);

		return () => {
			if (refreshInterval) clearInterval(refreshInterval);
		};
	});

	$effect(() => {
		// Re-load when filters change
		loadLogs();
	});
</script>

<div class="p-6 space-y-6 h-full flex flex-col">
	<!-- Header -->
	<div class="flex items-center justify-between shrink-0">
		<div>
			<h1 class="text-3xl font-bold tracking-tight flex items-center gap-2">
				<Activity
					class="h-8 w-8 {!isPaused ? 'text-success animate-pulse' : 'text-muted-foreground'}"
				/>
				Live-Logs
			</h1>
			<p class="text-muted-foreground">Echtzeit-Log-Stream aller überwachten Container</p>
		</div>
		<div class="flex items-center gap-2">
			<Button variant={isPaused ? 'default' : 'outline'} onclick={togglePause}>
				{#if isPaused}
					<Play class="h-4 w-4" />
					Fortsetzen
				{:else}
					<Pause class="h-4 w-4" />
					Pausieren
				{/if}
			</Button>
			<Button variant="outline" onclick={clearLogs}>
				<Trash2 class="h-4 w-4" />
				Leeren
			</Button>
		</div>
	</div>

	<!-- Filters -->
	<Card class="shrink-0">
		<CardContent class="py-4">
			<div class="flex flex-wrap items-center gap-4">
				<div class="flex items-center gap-2">
					<Filter class="h-4 w-4 text-muted-foreground" />
					<span class="text-sm text-muted-foreground">Filter:</span>
				</div>

				<Select
					type="single"
					value={selectedContainer}
					onValueChange={(v) => (selectedContainer = v)}
				>
					<SelectTrigger class="w-[180px]">
						{#if selectedContainer}
							{selectedContainer}
						{:else}
							<span class="text-muted-foreground">Alle Container</span>
						{/if}
					</SelectTrigger>
					<SelectContent>
						{#each containers as container}
							<SelectItem value={container.name}>{container.name}</SelectItem>
						{/each}
					</SelectContent>
				</Select>

				<Select type="single" value={selectedStream} onValueChange={(v) => (selectedStream = v)}>
					<SelectTrigger class="w-[140px]">
						{#if selectedStream}
							{selectedStream}
						{:else}
							<span class="text-muted-foreground">Alle Streams</span>
						{/if}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="stdout">stdout</SelectItem>
						<SelectItem value="stderr">stderr</SelectItem>
					</SelectContent>
				</Select>

				<div class="ml-auto flex items-center gap-4">
					<label class="flex items-center gap-2 text-sm">
						<input type="checkbox" bind:checked={autoScroll} class="rounded" />
						Auto-Scroll
					</label>
					{#if !isPaused}
						<Badge variant="success" class="animate-pulse">
							<Activity class="h-3 w-3 mr-1" />
							Live
						</Badge>
					{:else}
						<Badge variant="secondary">
							<Pause class="h-3 w-3 mr-1" />
							Pausiert
						</Badge>
					{/if}
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Log Output -->
	<Card class="flex-1 min-h-0 flex flex-col">
		<CardHeader class="shrink-0 pb-2">
			<CardTitle class="text-sm font-medium flex items-center justify-between">
				<span>Log-Ausgabe</span>
				<span class="text-muted-foreground font-normal">{logs.length} Einträge</span>
			</CardTitle>
		</CardHeader>
		<CardContent class="flex-1 min-h-0 p-0">
			<div class="h-full overflow-auto bg-black/50 rounded-b-xl font-mono text-sm p-4">
				{#if logs.length === 0}
					<div class="flex items-center justify-center h-full text-muted-foreground">
						{#if isLoading}
							<RefreshCw class="h-6 w-6 animate-spin" />
						{:else}
							<span>Warte auf Logs...</span>
						{/if}
					</div>
				{:else}
					{#each [...logs].reverse() as log (log.id)}
						<div
							class="flex gap-2 py-0.5 hover:bg-white/5 px-2 -mx-2 rounded {log.stream === 'stderr'
								? 'text-red-400'
								: 'text-green-400/90'}"
						>
							<span class="text-muted-foreground shrink-0">{formatTimestamp(log.timestamp)}</span>
							<span class="text-blue-400 shrink-0 w-[120px] truncate" title={log.containerName}>
								{log.containerName}
							</span>
							<span
								class="shrink-0 w-[60px] {log.stream === 'stderr'
									? 'text-red-500'
									: 'text-green-500'}"
							>
								{log.stream}
							</span>
							<span class="text-foreground/90 break-all">{log.message}</span>
						</div>
					{/each}
				{/if}
			</div>
		</CardContent>
	</Card>
</div>
