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
	import {
		Container,
		Activity,
		Server,
		AlertCircle,
		CheckCircle2,
		RefreshCw,
		TrendingUp,
		BarChart3
	} from 'lucide-svelte';
	import LogHistogram from '$lib/components/LogHistogram.svelte';

	interface ContainerInfo {
		id: string;
		shortId: string;
		name: string;
		image: string;
		state: string;
		status: string;
		created: number;
	}

	interface Stats {
		total: number;
		running: number;
		stopped: number;
		logCount: number;
	}

	interface HistogramData {
		minute: string;
		count: number;
		timestamp: number;
	}

	interface ContainerOption {
		id: string;
		name: string;
		count: number;
	}

	let containers = $state<ContainerInfo[]>([]);
	let containerOptions = $state<ContainerOption[]>([]);
	let stats = $state<Stats>({ total: 0, running: 0, stopped: 0, logCount: 0 });
	let isLoading = $state(true);
	let histogramData = $state<HistogramData[]>([]);
	let selectedMinutes = $state('60');
	let selectedContainer = $state<string | undefined>(undefined);

	async function loadData() {
		isLoading = true;
		try {
			const [containersRes, logsRes] = await Promise.all([
				fetch('/api/containers'),
				fetch('/api/logs/containers')
			]);

			if (containersRes.ok) {
				const data = await containersRes.json();
				containers = data.containers;

				stats = {
					total: containers.length,
					running: containers.filter((c) => c.state === 'running').length,
					stopped: containers.filter((c) => c.state !== 'running').length,
					logCount: 0
				};
			}

			if (logsRes.ok) {
				const data = await logsRes.json();
				containerOptions = data.containers;
				stats.logCount = data.containers.reduce(
					(acc: number, c: { count: number }) => acc + c.count,
					0
				);
			}

			await loadHistogram();
		} catch (error) {
			console.error('Error loading data:', error);
		} finally {
			isLoading = false;
		}
	}

	async function loadHistogram() {
		try {
			const params = new URLSearchParams({ minutes: selectedMinutes });
			if (selectedContainer) {
				params.set('container', selectedContainer);
			}

			const res = await fetch(`/api/logs/histogram?${params}`);
			if (res.ok) {
				const data = await res.json();
				histogramData = data.histogram;
			}
		} catch (error) {
			console.error('Error loading histogram:', error);
		}
	}

	function handleMinutesChange(value: string | undefined) {
		if (value) {
			selectedMinutes = value;
			loadHistogram();
		}
	}

	function handleContainerChange(value: string | undefined) {
		selectedContainer = value || undefined;
		loadHistogram();
	}

	$effect(() => {
		loadData();
		const interval = setInterval(loadData, 30000);
		return () => clearInterval(interval);
	});

	function formatUptime(status: string): string {
		const match = status.match(/Up\s+(.+)/i);
		return match ? match[1] : status;
	}
</script>

<div class="p-6 space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Dashboard</h1>
			<p class="text-muted-foreground">Übersicht über deine Docker-Container und Logs</p>
		</div>
		<Button variant="outline" onclick={loadData} disabled={isLoading}>
			<RefreshCw class="h-4 w-4 {isLoading ? 'animate-spin' : ''}" />
			Aktualisieren
		</Button>
	</div>

	<!-- Stats Cards -->
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">Container gesamt</CardTitle>
				<Container class="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{stats.total}</div>
				<p class="text-xs text-muted-foreground">Mit Label loggator.enable=true</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">Aktiv</CardTitle>
				<CheckCircle2 class="h-4 w-4 text-success" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold text-success">{stats.running}</div>
				<p class="text-xs text-muted-foreground">Container laufen</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">Gestoppt</CardTitle>
				<AlertCircle class="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{stats.stopped}</div>
				<p class="text-xs text-muted-foreground">Container inaktiv</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">Logs indiziert</CardTitle>
				<TrendingUp class="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{stats.logCount.toLocaleString('de-DE')}</div>
				<p class="text-xs text-muted-foreground">Einträge in Meilisearch</p>
			</CardContent>
		</Card>
	</div>

	<!-- Log Activity Chart -->
	<Card>
		<CardHeader>
			<div class="flex items-center justify-between">
				<div>
					<CardTitle class="flex items-center gap-2">
						<BarChart3 class="h-5 w-5" />
						Log-Aktivität
					</CardTitle>
					<CardDescription>Anzahl der Logs pro Minute</CardDescription>
				</div>
				<div class="flex items-center gap-2">
					<Select type="single" value={selectedContainer} onValueChange={handleContainerChange}>
						<SelectTrigger class="w-[180px]">
							{selectedContainer
								? containerOptions.find((c) => c.name === selectedContainer)?.name
								: 'Alle Container'}
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="">Alle Container</SelectItem>
							{#each containerOptions as container}
								<SelectItem value={container.name}>{container.name}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
					<Select type="single" value={selectedMinutes} onValueChange={handleMinutesChange}>
						<SelectTrigger class="w-[140px]">
							{selectedMinutes === '30'
								? '30 Minuten'
								: selectedMinutes === '60'
									? '1 Stunde'
									: selectedMinutes === '120'
										? '2 Stunden'
										: '6 Stunden'}
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="30">30 Minuten</SelectItem>
							<SelectItem value="60">1 Stunde</SelectItem>
							<SelectItem value="120">2 Stunden</SelectItem>
							<SelectItem value="360">6 Stunden</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>
		</CardHeader>
		<CardContent>
			<div class="h-[300px]">
				<LogHistogram data={histogramData} />
			</div>
		</CardContent>
	</Card>

	<!-- Recent Containers -->
	<Card>
		<CardHeader>
			<CardTitle>Container-Status</CardTitle>
			<CardDescription>Alle überwachten Container und ihr aktueller Status</CardDescription>
		</CardHeader>
		<CardContent>
			{#if isLoading}
				<div class="flex items-center justify-center py-8">
					<RefreshCw class="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			{:else if containers.length === 0}
				<div class="text-center py-8 text-muted-foreground">
					<Container class="h-12 w-12 mx-auto mb-4 opacity-50" />
					<p>
						Keine Container mit Label <code class="text-xs">loggator.enable=true</code> gefunden
					</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each containers.slice(0, 5) as container}
						<div
							class="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
						>
							<div class="flex items-center gap-4">
								<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
									<Server class="h-5 w-5" />
								</div>
								<div>
									<div class="font-medium">{container.name}</div>
									<div class="text-sm text-muted-foreground">{container.image}</div>
								</div>
							</div>
							<div class="flex items-center gap-4">
								<div class="text-sm text-muted-foreground text-right">
									{formatUptime(container.status)}
								</div>
								<Badge variant={container.state === 'running' ? 'success' : 'secondary'}>
									{container.state === 'running' ? 'Aktiv' : 'Gestoppt'}
								</Badge>
							</div>
						</div>
					{/each}

					{#if containers.length > 5}
						<div class="text-center pt-2">
							<a href="/dashboard/containers" class="text-sm text-primary hover:underline">
								Alle {containers.length} Container anzeigen →
							</a>
						</div>
					{/if}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
