<script lang="ts">
	import {
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
		Badge,
		Button
	} from '$lib/components/ui';
	import { Container, Play, Square, RefreshCw, Server, Clock, Box } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { t, formatDate as formatDateI18n } from '$lib/i18n';

	interface ContainerInfo {
		id: string;
		shortId: string;
		name: string;
		image: string;
		state: string;
		status: string;
		created: number;
		labels: Record<string, string>;
	}

	let containers = $state<ContainerInfo[]>([]);
	let isLoading = $state(true);
	let actionLoading = $state<string | null>(null);

	async function loadContainers() {
		isLoading = true;
		try {
			const response = await fetch('/api/containers');
			if (!response.ok) throw new Error('Failed to load containers');
			const data = await response.json();
			containers = data.containers;
		} catch (error) {
			console.error('Error loading containers:', error);
			toast.error($t.containers.errorLoading, {
				description: error instanceof Error ? error.message : $t.common.unknownError
			});
		} finally {
			isLoading = false;
		}
	}

	async function startContainer(id: string, name: string) {
		actionLoading = id;

		try {
			const response = await fetch(`/api/containers/${id}/start`, { method: 'POST' });
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to start container');
			}

			toast.success($t.containers.containerStarted, {
				description: `${name} ${$t.containers.containerStartedDesc}`
			});
			await loadContainers();
		} catch (error) {
			toast.error($t.containers.errorStarting, {
				description: error instanceof Error ? error.message : $t.common.unknownError
			});
		} finally {
			actionLoading = null;
		}
	}

	async function stopContainer(id: string, name: string) {
		actionLoading = id;

		try {
			const response = await fetch(`/api/containers/${id}/stop`, { method: 'POST' });
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to stop container');
			}

			toast.success($t.containers.containerStopped, {
				description: `${name} ${$t.containers.containerStoppedDesc}`
			});
			await loadContainers();
		} catch (error) {
			toast.error($t.containers.errorStopping, {
				description: error instanceof Error ? error.message : $t.common.unknownError
			});
		} finally {
			actionLoading = null;
		}
	}

	function formatDate(timestamp: number): string {
		return formatDateI18n(timestamp * 1000, {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	$effect(() => {
		loadContainers();
		const interval = setInterval(loadContainers, 30000);
		return () => clearInterval(interval);
	});
</script>

<div class="p-6 space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">{$t.containers.title}</h1>
			<p class="text-muted-foreground">{$t.containers.subtitle}</p>
		</div>
		<Button variant="outline" onclick={loadContainers} disabled={isLoading}>
			<RefreshCw class="h-4 w-4 {isLoading ? 'animate-spin' : ''}" />
			{$t.common.refresh}
		</Button>
	</div>

	<!-- Stats -->
	<div class="grid gap-4 md:grid-cols-3">
		<Card>
			<CardContent class="pt-6">
				<div class="flex items-center gap-4">
					<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
						<Container class="h-6 w-6 text-primary" />
					</div>
					<div>
						<p class="text-2xl font-bold">{containers.length}</p>
						<p class="text-sm text-muted-foreground">{$t.dashboard.totalContainers}</p>
					</div>
				</div>
			</CardContent>
		</Card>
		<Card>
			<CardContent class="pt-6">
				<div class="flex items-center gap-4">
					<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
						<Play class="h-6 w-6 text-success" />
					</div>
					<div>
						<p class="text-2xl font-bold text-success">
							{containers.filter((c) => c.state === 'running').length}
						</p>
						<p class="text-sm text-muted-foreground">{$t.dashboard.active}</p>
					</div>
				</div>
			</CardContent>
		</Card>
		<Card>
			<CardContent class="pt-6">
				<div class="flex items-center gap-4">
					<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
						<Square class="h-6 w-6 text-muted-foreground" />
					</div>
					<div>
						<p class="text-2xl font-bold">
							{containers.filter((c) => c.state !== 'running').length}
						</p>
						<p class="text-sm text-muted-foreground">{$t.dashboard.stopped}</p>
					</div>
				</div>
			</CardContent>
		</Card>
	</div>

	<!-- Container List -->
	<Card>
		<CardHeader>
			<CardTitle>{$t.containers.containerList}</CardTitle>
			<CardDescription>
				{$t.containers.containerListDesc}
				<code class="text-xs bg-secondary px-1 py-0.5 rounded">loggator.enable=true</code>
			</CardDescription>
		</CardHeader>
		<CardContent>
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<RefreshCw class="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			{:else if containers.length === 0}
				<div class="text-center py-12 text-muted-foreground">
					<Container class="h-12 w-12 mx-auto mb-4 opacity-50" />
					<p class="text-lg font-medium">{$t.containers.noContainersFound}</p>
					<p class="text-sm">
						{$t.containers.addLabelHint}
						<code class="text-xs bg-secondary px-1 py-0.5 rounded">loggator.enable=true</code>
						{$t.containers.addLabelHintSuffix}
					</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each containers as container}
						<div
							class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
						>
							<div class="flex items-center gap-4">
								<div
									class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg {container.state ===
									'running'
										? 'bg-success/10'
										: 'bg-secondary'}"
								>
									<Server
										class="h-6 w-6 {container.state === 'running'
											? 'text-success'
											: 'text-muted-foreground'}"
									/>
								</div>
								<div class="min-w-0">
									<div class="flex items-center gap-2">
										<span class="font-semibold truncate">{container.name}</span>
										<Badge variant={container.state === 'running' ? 'success' : 'secondary'}>
											{container.state === 'running' ? $t.dashboard.active : $t.dashboard.stopped}
										</Badge>
									</div>
									<div
										class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1"
									>
										<span class="flex items-center gap-1">
											<Box class="h-3 w-3" />
											{container.image}
										</span>
										<span class="flex items-center gap-1">
											<Clock class="h-3 w-3" />
											{container.status}
										</span>
									</div>
									<div class="text-xs text-muted-foreground mt-1">
										ID: {container.shortId}
									</div>
								</div>
							</div>

							<div class="flex items-center gap-2 shrink-0">
								{#if container.state === 'running'}
									<Button
										variant="outline"
										size="sm"
										onclick={() => stopContainer(container.id, container.name)}
										disabled={actionLoading === container.id}
									>
										{#if actionLoading === container.id}
											<RefreshCw class="h-4 w-4 animate-spin" />
										{:else}
											<Square class="h-4 w-4" />
										{/if}
										{$t.containers.stop}
									</Button>
								{:else}
									<Button
										variant="default"
										size="sm"
										onclick={() => startContainer(container.id, container.name)}
										disabled={actionLoading === container.id}
									>
										{#if actionLoading === container.id}
											<RefreshCw class="h-4 w-4 animate-spin" />
										{:else}
											<Play class="h-4 w-4" />
										{/if}
										{$t.containers.start}
									</Button>
								{/if}
								<a
									href="/dashboard/search?container={container.name}"
									class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-8 px-3"
								>
									{$t.containers.viewLogs}
								</a>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
