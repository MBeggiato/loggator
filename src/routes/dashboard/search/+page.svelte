<script lang="ts">
	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
		Badge,
		Button,
		Input,
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger
	} from '$lib/components/ui';
	import { Search, Filter, RefreshCw, X } from 'lucide-svelte';
	import { page } from '$app/stores';
	import { toast } from 'svelte-sonner';

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

	interface Container {
		id: string;
		name: string;
		count: number;
	}

	let searchQuery = $state('');
	let selectedContainer = $state<string | undefined>(undefined);
	let selectedStream = $state<string | undefined>(undefined);
	let containers = $state<Container[]>([]);
	let logs = $state<LogHit[]>([]);
	let isLoading = $state(false);
	let totalResults = $state(0);
	let processingTime = $state(0);

	// Initialize from URL params
	$effect(() => {
		const urlContainer = $page.url.searchParams.get('container');
		if (urlContainer) {
			selectedContainer = urlContainer;
		}
	});

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

		try {
			const params = new URLSearchParams();
			if (searchQuery) params.set('q', searchQuery);
			if (selectedContainer) params.set('container', selectedContainer);
			if (selectedStream) params.set('stream', selectedStream);
			params.set('limit', '200');

			const response = await fetch(`/api/logs/search?${params}`);
			if (!response.ok) throw new Error('Search failed');

			const data = await response.json();
			logs = data.hits;
			totalResults = data.total;
			processingTime = data.processingTimeMs;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
			toast.error('Suche fehlgeschlagen', {
				description: message
			});
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
		selectedContainer = undefined;
		selectedStream = undefined;
		searchLogs();
	}

	function handleContainerChange(value: string | undefined) {
		selectedContainer = value;
		searchLogs();
	}

	function handleStreamChange(value: string | undefined) {
		selectedStream = value;
		searchLogs();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			searchLogs();
		}
	}

	$effect(() => {
		loadContainers();
		searchLogs();
	});
</script>

<div class="p-6 space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Log-Suche</h1>
			<p class="text-muted-foreground">Durchsuche alle Container-Logs mit Volltextsuche</p>
		</div>
	</div>

	<!-- Search & Filters Card -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<Search class="h-5 w-5" />
				Suchfilter
			</CardTitle>
			<CardDescription>Suche nach Logs mit verschiedenen Filteroptionen</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4">
			<!-- Search Input -->
			<div class="flex gap-2">
				<div class="relative flex-1">
					<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						type="text"
						bind:value={searchQuery}
						placeholder="Suche in Logs..."
						class="pl-10"
						onkeydown={handleKeyDown}
					/>
				</div>
				<Button onclick={searchLogs} disabled={isLoading}>
					{#if isLoading}
						<RefreshCw class="h-4 w-4 animate-spin" />
					{:else}
						<Search class="h-4 w-4" />
					{/if}
					Suchen
				</Button>
			</div>

			<!-- Filters -->
			<div class="flex flex-wrap items-center gap-4">
				<div class="flex items-center gap-2">
					<Filter class="h-4 w-4 text-muted-foreground" />
					<Select type="single" value={selectedContainer} onValueChange={handleContainerChange}>
						<SelectTrigger class="w-[200px]">
							{#if selectedContainer}
								{containers.find((c) => c.name === selectedContainer)?.name ?? selectedContainer}
							{:else}
								<span class="text-muted-foreground">Alle Container</span>
							{/if}
						</SelectTrigger>
						<SelectContent>
							{#each containers as container}
								<SelectItem value={container.name}>
									{container.name} ({container.count})
								</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</div>

				<Select type="single" value={selectedStream} onValueChange={handleStreamChange}>
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

				{#if searchQuery || selectedContainer || selectedStream}
					<Button variant="ghost" size="sm" onclick={clearFilters}>
						<X class="h-4 w-4" />
						Filter zurücksetzen
					</Button>
				{/if}

				<div class="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
					<span>{totalResults.toLocaleString('de-DE')} Ergebnisse</span>
					<span>•</span>
					<span>{processingTime}ms</span>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Results Card -->
	<Card>
		<CardHeader>
			<CardTitle>Suchergebnisse</CardTitle>
			<CardDescription>
				{#if logs.length > 0}
					{logs.length} von {totalResults.toLocaleString('de-DE')} Einträgen angezeigt
				{:else}
					Keine Logs gefunden
				{/if}
			</CardDescription>
		</CardHeader>
		<CardContent>
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<RefreshCw class="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			{:else if logs.length === 0}
				<div class="text-center py-12 text-muted-foreground">
					<Search class="h-12 w-12 mx-auto mb-4 opacity-50" />
					<p class="text-lg font-medium">Keine Logs gefunden</p>
					<p class="text-sm">
						Container mit Label <code class="text-xs bg-secondary px-1 py-0.5 rounded"
							>loggator.enable=true</code
						> werden überwacht
					</p>
				</div>
			{:else}
				<div class="space-y-1 font-mono text-sm max-h-[600px] overflow-auto">
					{#each logs as log (log.id)}
						<div
							class="flex items-start gap-3 px-3 py-2 rounded hover:bg-accent/50 transition-colors group {log.stream ===
							'stderr'
								? 'bg-destructive/5'
								: ''}"
						>
							<span class="text-muted-foreground whitespace-nowrap shrink-0">
								{formatTimestamp(log.timestamp)}
							</span>
							<Badge
								variant={log.stream === 'stderr' ? 'destructive' : 'secondary'}
								class="shrink-0"
							>
								{log.stream}
							</Badge>
							<span
								class="text-primary/80 font-medium shrink-0 max-w-[150px] truncate"
								title={log.containerName}
							>
								{log.containerName}
							</span>
							<span class="break-all {log.stream === 'stderr' ? 'text-destructive' : ''}">
								{log.message}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
