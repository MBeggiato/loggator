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
	import ChatBubble from '$lib/components/ChatBubble.svelte';
	import { t, formatNumber } from '$lib/i18n';

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
				// Verwende die echte Gesamtanzahl aus Meilisearch Stats
				stats.logCount =
					data.totalCount ??
					data.containers.reduce((acc: number, c: { count: number }) => acc + c.count, 0);
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
			<h1 class="text-3xl font-bold tracking-tight">{$t.dashboard.title}</h1>
			<p class="text-muted-foreground">{$t.dashboard.subtitle}</p>
		</div>
		<Button variant="outline" onclick={loadData} disabled={isLoading}>
			<RefreshCw class="h-4 w-4 {isLoading ? 'animate-spin' : ''}" />
			{$t.common.refresh}
		</Button>
	</div>

	<!-- Stats Cards -->
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">{$t.dashboard.totalContainers}</CardTitle>
				<div class="p-2 bg-primary/10 rounded-lg">
					<Container class="h-4 w-4 text-primary" />
				</div>
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{stats.total}</div>
				<p class="text-xs text-muted-foreground">{$t.dashboard.totalContainersDesc}</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">{$t.dashboard.active}</CardTitle>
				<div class="p-2 bg-green-500/10 rounded-lg">
					<CheckCircle2 class="h-4 w-4 text-green-500" />
				</div>
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold text-green-500">{stats.running}</div>
				<p class="text-xs text-muted-foreground">{$t.dashboard.activeDesc}</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">{$t.dashboard.stopped}</CardTitle>
				<div class="p-2 bg-amber-500/10 rounded-lg">
					<AlertCircle class="h-4 w-4 text-amber-500" />
				</div>
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold">{stats.stopped}</div>
				<p class="text-xs text-muted-foreground">{$t.dashboard.stoppedDesc}</p>
			</CardContent>
		</Card>

		<Card>
			<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle class="text-sm font-medium">{$t.dashboard.logsIndexed}</CardTitle>
				<div class="p-2 bg-blue-500/10 rounded-lg">
					<BarChart3 class="h-4 w-4 text-blue-500" />
				</div>
			</CardHeader>
			<CardContent>
				<div class="text-2xl font-bold text-blue-500">{formatNumber(stats.logCount)}</div>
				<p class="text-xs text-muted-foreground">{$t.dashboard.logsIndexedDesc}</p>
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
						{$t.dashboard.logActivity}
					</CardTitle>
					<CardDescription>{$t.dashboard.logActivityDesc}</CardDescription>
				</div>
				<div class="flex items-center gap-2">
					<Select type="single" value={selectedContainer} onValueChange={handleContainerChange}>
						<SelectTrigger class="w-[180px]">
							{selectedContainer
								? containerOptions.find((c) => c.name === selectedContainer)?.name
								: $t.dashboard.allContainers}
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="">{$t.dashboard.allContainers}</SelectItem>
							{#each containerOptions as container}
								<SelectItem value={container.name}>{container.name}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
					<Select type="single" value={selectedMinutes} onValueChange={handleMinutesChange}>
						<SelectTrigger class="w-[140px]">
							{selectedMinutes === '30'
								? $t.dashboard.minutes30
								: selectedMinutes === '60'
									? $t.dashboard.hour1
									: selectedMinutes === '120'
										? $t.dashboard.hours2
										: $t.dashboard.hours6}
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="30">{$t.dashboard.minutes30}</SelectItem>
							<SelectItem value="60">{$t.dashboard.hour1}</SelectItem>
							<SelectItem value="120">{$t.dashboard.hours2}</SelectItem>
							<SelectItem value="360">{$t.dashboard.hours6}</SelectItem>
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
			<CardTitle>{$t.dashboard.containerStatus}</CardTitle>
			<CardDescription>{$t.dashboard.containerStatusDesc}</CardDescription>
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
						{$t.dashboard.noContainersFound} <code class="text-xs">loggator.enable=true</code>
						{$t.dashboard.noContainersFoundSuffix}
					</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each containers.slice(0, 5) as container}
						{@const containerLogs = containerOptions.find((c) => c.id === container.id)}
						<div
							class="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
						>
							<div class="flex items-center gap-4 flex-1">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-lg {container.state ===
									'running'
										? 'bg-green-500/10'
										: 'bg-secondary'}"
								>
									<Server
										class="h-5 w-5 {container.state === 'running'
											? 'text-green-500'
											: 'text-muted-foreground'}"
									/>
								</div>
								<div class="flex-1 min-w-0">
									<div class="font-medium truncate">{container.name}</div>
									<div class="text-sm text-muted-foreground truncate">{container.image}</div>
								</div>
							</div>
							<div class="flex items-center gap-3">
								{#if containerLogs}
									<div class="text-right">
										<div class="text-xs text-muted-foreground">{$t.dashboard.logs}</div>
										<div class="text-sm font-medium">{formatNumber(containerLogs.count)}</div>
									</div>
								{/if}
								<div class="text-sm text-muted-foreground text-right min-w-[100px]">
									{formatUptime(container.status)}
								</div>
								<Badge variant={container.state === 'running' ? 'success' : 'secondary'}>
									{container.state === 'running' ? $t.dashboard.active : $t.dashboard.stopped}
								</Badge>
							</div>
						</div>
					{/each}

					{#if containers.length > 5}
						<div class="text-center pt-2">
							<a href="/containers" class="text-sm text-primary hover:underline">
								{$t.dashboard.viewLogs} ({containers.length}) →
							</a>
						</div>
					{/if}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>

<!-- KI Chat Bubble -->
<ChatBubble />
