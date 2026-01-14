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
			toast.error('Fehler beim Laden der Container', {
				description: error instanceof Error ? error.message : 'Unbekannter Fehler'
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

			toast.success('Container gestartet', {
				description: `${name} wurde erfolgreich gestartet`
			});
			await loadContainers();
		} catch (error) {
			toast.error('Fehler beim Starten', {
				description: error instanceof Error ? error.message : 'Unbekannter Fehler'
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

			toast.success('Container gestoppt', {
				description: `${name} wurde erfolgreich gestoppt`
			});
			await loadContainers();
		} catch (error) {
			toast.error('Fehler beim Stoppen', {
				description: error instanceof Error ? error.message : 'Unbekannter Fehler'
			});
		} finally {
			actionLoading = null;
		}
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp * 1000).toLocaleDateString('de-DE', {
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
			<h1 class="text-3xl font-bold tracking-tight">Container</h1>
			<p class="text-muted-foreground">Verwalte deine überwachten Docker-Container</p>
		</div>
		<Button variant="outline" onclick={loadContainers} disabled={isLoading}>
			<RefreshCw class="h-4 w-4 {isLoading ? 'animate-spin' : ''}" />
			Aktualisieren
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
						<p class="text-sm text-muted-foreground">Container gesamt</p>
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
						<p class="text-sm text-muted-foreground">Aktiv</p>
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
						<p class="text-sm text-muted-foreground">Gestoppt</p>
					</div>
				</div>
			</CardContent>
		</Card>
	</div>

	<!-- Container List -->
	<Card>
		<CardHeader>
			<CardTitle>Container-Liste</CardTitle>
			<CardDescription>
				Alle Container mit dem Label <code class="text-xs bg-secondary px-1 py-0.5 rounded"
					>loggator.enable=true</code
				>
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
					<p class="text-lg font-medium">Keine Container gefunden</p>
					<p class="text-sm">
						Füge deinen Containern das Label <code class="text-xs bg-secondary px-1 py-0.5 rounded"
							>loggator.enable=true</code
						> hinzu
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
											{container.state === 'running' ? 'Aktiv' : 'Gestoppt'}
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
										Stoppen
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
										Starten
									</Button>
								{/if}
								<a
									href="/dashboard/search?container={container.name}"
									class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-8 px-3"
								>
									Logs anzeigen
								</a>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
