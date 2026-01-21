<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Trash2, Plus, Send, ExternalLink } from 'lucide-svelte';

	interface AppriseChannel {
		id: string;
		name: string;
		url: string;
		enabled: boolean;
		filters: {
			containers?: string[];
			minSeverity?: 'low' | 'medium' | 'high' | 'critical';
		};
		createdAt: Date;
		updatedAt: Date;
	}

	let channels = $state<AppriseChannel[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let testingChannel = $state<string | null>(null);

	// Formular State
	let showForm = $state(false);
	let editingId = $state<string | null>(null);
	let formData = $state({
		name: '',
		url: '',
		enabled: true,
		containers: '',
		minSeverity: 'medium' as 'low' | 'medium' | 'high' | 'critical'
	});

	onMount(() => {
		loadChannels();
	});

	async function loadChannels() {
		try {
			loading = true;
			error = null;
			const response = await fetch('/api/notifications/channels');
			const data = await response.json();

			if (!data.success) {
				throw new Error(data.error || 'Failed to load channels');
			}

			channels = data.channels;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
			console.error('Error loading channels:', err);
		} finally {
			loading = false;
		}
	}

	function generateId(): string {
		return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
	}

	async function saveChannel() {
		try {
			const channel: Omit<AppriseChannel, 'createdAt' | 'updatedAt'> = {
				id: editingId || generateId(),
				name: formData.name,
				url: formData.url,
				enabled: formData.enabled,
				filters: {
					containers: formData.containers
						? formData.containers.split(',').map((s) => s.trim())
						: [],
					minSeverity: formData.minSeverity
				}
			};

			const response = await fetch('/api/notifications/channels', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(channel)
			});

			const data = await response.json();

			if (!data.success) {
				throw new Error(data.error || 'Failed to save channel');
			}

			await loadChannels();
			resetForm();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to save channel');
		}
	}

	async function deleteChannel(id: string) {
		if (!confirm('Möchten Sie diesen Channel wirklich löschen?')) return;

		try {
			const response = await fetch(`/api/notifications/channels?id=${id}`, {
				method: 'DELETE'
			});

			const data = await response.json();

			if (!data.success) {
				throw new Error(data.error || 'Failed to delete channel');
			}

			await loadChannels();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to delete channel');
		}
	}

	async function testChannel(id: string) {
		try {
			testingChannel = id;
			const response = await fetch('/api/notifications/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ channelId: id })
			});

			const data = await response.json();

			if (!data.success) {
				throw new Error(data.error || 'Test failed');
			}

			alert('Test-Benachrichtigung wurde gesendet! Bitte überprüfen Sie Ihren Channel.');
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Test failed');
		} finally {
			testingChannel = null;
		}
	}

	function editChannel(channel: AppriseChannel) {
		editingId = channel.id;
		formData = {
			name: channel.name,
			url: channel.url,
			enabled: channel.enabled,
			containers: channel.filters.containers?.join(', ') || '',
			minSeverity: channel.filters.minSeverity || 'medium'
		};
		showForm = true;
	}

	function resetForm() {
		showForm = false;
		editingId = null;
		formData = {
			name: '',
			url: '',
			enabled: true,
			containers: '',
			minSeverity: 'medium'
		};
	}

	function getServiceType(url: string): string {
		const match = url.match(/^(\w+):\/\//);
		return match ? match[1] : 'unknown';
	}

	const serviceIcons: Record<string, string> = {
		slack: '💬',
		discord: '🎮',
		mailto: '📧',
		tgram: '✈️',
		msteams: '👥',
		webhook: '🔗'
	};

	const severityColors: Record<string, string> = {
		low: 'bg-blue-500',
		medium: 'bg-yellow-500',
		high: 'bg-orange-500',
		critical: 'bg-red-500'
	};
</script>

<div class="container mx-auto p-6 space-y-6">
	<div class="flex justify-between items-center">
		<div>
			<h1 class="text-3xl font-bold">Benachrichtigungen</h1>
			<p class="text-muted-foreground">Konfigurieren Sie Notification-Channels über Apprise</p>
		</div>
		<Button onclick={() => (showForm = !showForm)}>
			<Plus class="mr-2 h-4 w-4" />
			{showForm ? 'Abbrechen' : 'Channel hinzufügen'}
		</Button>
	</div>

	<!-- Info Card -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">ℹ️ Über Apprise URLs</CardTitle>
			<CardDescription>
				Apprise verwendet URL-Schemas für verschiedene Services.
				<a
					href="https://github.com/caronc/apprise"
					target="_blank"
					class="inline-flex items-center gap-1 text-primary hover:underline ml-2"
				>
					Dokumentation <ExternalLink class="h-3 w-3" />
				</a>
			</CardDescription>
		</CardHeader>
		<CardContent class="space-y-2 text-sm">
			<div><strong>Slack:</strong> slack://TokenA/TokenB/TokenC/Channel</div>
			<div><strong>Discord:</strong> discord://webhook_id/webhook_token</div>
			<div><strong>Email:</strong> mailto://user:pass@gmail.com</div>
			<div><strong>Telegram:</strong> tgram://bottoken/ChatID</div>
			<div><strong>MS Teams:</strong> msteams://TokenA/TokenB/TokenC</div>
		</CardContent>
	</Card>

	<!-- Formular -->
	{#if showForm}
		<Card>
			<CardHeader>
				<CardTitle>{editingId ? 'Channel bearbeiten' : 'Neuer Channel'}</CardTitle>
				<CardDescription>Geben Sie die Apprise-URL und Filter-Einstellungen ein</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onsubmit={(e) => {
						e.preventDefault();
						saveChannel();
					}}
					class="space-y-4"
				>
					<div>
						<label class="block text-sm font-medium mb-1">Name</label>
						<Input bind:value={formData.name} placeholder="z.B. Team Slack" required />
					</div>

					<div>
						<label class="block text-sm font-medium mb-1">Apprise URL</label>
						<Input bind:value={formData.url} placeholder="slack://..." required />
						<p class="text-xs text-muted-foreground mt-1">
							Siehe Dokumentation oben für URL-Beispiele
						</p>
					</div>

					<div>
						<label class="block text-sm font-medium mb-1"> Container Filter (optional) </label>
						<Input bind:value={formData.containers} placeholder="container1, container2, *-prod" />
						<p class="text-xs text-muted-foreground mt-1">
							Komma-getrennt, * als Wildcard. Leer = alle Container
						</p>
					</div>

					<div>
						<label class="block text-sm font-medium mb-1">Mindest-Severity</label>
						<select bind:value={formData.minSeverity} class="w-full px-3 py-2 border rounded-md">
							<option value="low">Low (alle)</option>
							<option value="medium">Medium</option>
							<option value="high">High</option>
							<option value="critical">Critical</option>
						</select>
					</div>

					<div class="flex items-center gap-2">
						<input type="checkbox" id="enabled" bind:checked={formData.enabled} class="w-4 h-4" />
						<label for="enabled" class="text-sm font-medium">Channel aktiviert</label>
					</div>

					<div class="flex gap-2">
						<Button type="submit">
							{editingId ? 'Aktualisieren' : 'Erstellen'}
						</Button>
						<Button type="button" variant="outline" onclick={resetForm}>Abbrechen</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	{/if}

	<!-- Channel Liste -->
	{#if loading}
		<Card>
			<CardContent class="p-6 text-center">
				<p>Lade Channels...</p>
			</CardContent>
		</Card>
	{:else if error}
		<Card>
			<CardContent class="p-6 text-center text-red-500">
				<p>Fehler: {error}</p>
			</CardContent>
		</Card>
	{:else if channels.length === 0}
		<Card>
			<CardContent class="p-6 text-center text-muted-foreground">
				<p>Keine Channels konfiguriert. Erstellen Sie einen neuen Channel oben.</p>
			</CardContent>
		</Card>
	{:else}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each channels as channel (channel.id)}
				<Card>
					<CardHeader>
						<div class="flex justify-between items-start">
							<div>
								<CardTitle class="flex items-center gap-2">
									<span>{serviceIcons[getServiceType(channel.url)] || '📡'}</span>
									{channel.name}
								</CardTitle>
								<CardDescription class="mt-1">
									{getServiceType(channel.url).toUpperCase()}
								</CardDescription>
							</div>
							<Badge variant={channel.enabled ? 'default' : 'secondary'}>
								{channel.enabled ? 'Aktiv' : 'Inaktiv'}
							</Badge>
						</div>
					</CardHeader>
					<CardContent class="space-y-3">
						<!-- Filter Info -->
						<div class="space-y-1 text-sm">
							{#if channel.filters.containers && channel.filters.containers.length > 0}
								<div>
									<strong>Container:</strong>
									{channel.filters.containers.join(', ')}
								</div>
							{/if}
							<div>
								<strong>Min. Severity:</strong>
								<Badge class={severityColors[channel.filters.minSeverity || 'medium']}>
									{channel.filters.minSeverity || 'medium'}
								</Badge>
							</div>
						</div>

						<!-- Actions -->
						<div class="flex gap-2 pt-2">
							<Button variant="outline" size="sm" onclick={() => editChannel(channel)}>
								Bearbeiten
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={() => testChannel(channel.id)}
								disabled={testingChannel === channel.id}
							>
								<Send class="mr-1 h-3 w-3" />
								{testingChannel === channel.id ? 'Sende...' : 'Test'}
							</Button>
							<Button variant="destructive" size="sm" onclick={() => deleteChannel(channel.id)}>
								<Trash2 class="h-3 w-3" />
							</Button>
						</div>
					</CardContent>
				</Card>
			{/each}
		</div>
	{/if}
</div>
