<script lang="ts">
	import { X, Send, Loader2, Sparkles, Trash2 } from 'lucide-svelte';
	import { Button } from '$lib/components/ui';
	import ChatMessage from './ChatMessage.svelte';
	import { t } from '$lib/i18n';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	interface Message {
		id: string;
		role: 'user' | 'assistant';
		content: string;
		timestamp: Date;
		toolCalls?: any[];
	}

	const STORAGE_KEY = 'loggator-chat-history';

	let messages = $state<Message[]>([]);
	let input = $state('');
	let isLoading = $state(false);
	let messagesContainer: HTMLDivElement;

	// Load messages from localStorage
	function loadMessages() {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored);
				// Convert timestamp strings back to Date objects
				messages = parsed.map((m: any) => ({
					...m,
					timestamp: new Date(m.timestamp)
				}));
			}
		} catch (error) {
			console.error('Failed to load chat history:', error);
		}
	}

	// Save messages to localStorage
	function saveMessages() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
		} catch (error) {
			console.error('Failed to save chat history:', error);
		}
	}

	// Clear chat history
	function clearHistory() {
		if (confirm($t.chat.clearConfirm || 'Chat-Verlauf wirklich löschen?')) {
			messages = [];
			localStorage.removeItem(STORAGE_KEY);
			toast.success($t.chat.historyCleared || 'Chat-Verlauf gelöscht');
		}
	}

	// Load messages on mount
	onMount(() => {
		loadMessages();
		setTimeout(() => scrollToBottom(), 100);
	});

	async function sendMessage() {
		if (!input.trim() || isLoading) return;

		const userMessage: Message = {
			id: crypto.randomUUID(),
			role: 'user',
			content: input,
			timestamp: new Date()
		};

		messages = [...messages, userMessage];
		saveMessages(); // Save after adding user message
		input = '';
		isLoading = true;

		// Auto-scroll
		setTimeout(() => scrollToBottom(), 100);

		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({
					messages: messages.map((m) => ({
						role: m.role,
						content: m.content
					}))
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'API request failed');
			}

			const data = await response.json();

			if (!data.success) {
				throw new Error(data.error || 'Unknown error');
			}

			messages = [
				...messages,
				{
					id: crypto.randomUUID(),
					role: 'assistant',
					content: data.message,
					timestamp: new Date(),
					toolCalls: data.toolCalls || []
				}
			];

			// Save to localStorage
			saveMessages();

			// Auto-scroll nach Antwort
			setTimeout(() => scrollToBottom(), 100);
		} catch (error) {
			console.error('Chat error:', error);
			toast.error($t.chat.error, {
				description: error instanceof Error ? error.message : $t.chat.networkError
			});

			// Entferne letzte User-Message bei Fehler
			messages = messages.slice(0, -1);
		} finally {
			isLoading = false;
		}
	}

	function scrollToBottom() {
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	function setSuggestion(text: string) {
		input = text;
		setTimeout(() => sendMessage(), 100);
	}
</script>

<!-- Fixed Overlay rechts unten -->
<div
	class="fixed bottom-6 right-6 w-[700px] h-[700px] bg-card border-2 border-border rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden"
	role="dialog"
	aria-labelledby="chat-title"
>
	<!-- Header mit Gradient -->
	<div
		class="flex items-center justify-between p-4 border-b-2 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent"
	>
		<div class="flex items-center gap-2">
			<div class="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
				<Sparkles class="h-4 w-4 text-primary" />
			</div>
			<div>
				<h2 id="chat-title" class="text-white font-semibold">{$t.chat.title}</h2>
				<p class="text-[11px] text-white">{$t.chat.subtitle}</p>
			</div>
		</div>
		<div class="flex items-center gap-1">
			{#if messages.length > 0}
				<Button
					variant="ghost"
					size="icon"
					onclick={clearHistory}
					aria-label="Chat-Verlauf löschen"
					title="Chat-Verlauf löschen"
				>
					<Trash2 class="h-4 w-4" />
				</Button>
			{/if}
			<Button variant="ghost" size="icon" onclick={onClose} aria-label={$t.chat.closeChat}>
				<X class="h-4 w-4" />
			</Button>
		</div>
	</div>

	<!-- Chat Messages -->
	<div bind:this={messagesContainer} class="flex-1 overflow-y-auto space-y-4 p-4 bg-background">
		{#if messages.length === 0}
			<div class="flex flex-col items-center justify-center h-full text-center py-8">
				<div class="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
					<Sparkles class="h-8 w-8 text-primary" />
				</div>
				<p class="text-sm text-muted-foreground mb-6 max-w-xs">
					{$t.chat.emptyState}
				</p>
				<div class="space-y-2 w-full px-4">
					<button
						onclick={() => setSuggestion($t.chat.suggestion1)}
						class="w-full px-3 py-2.5 text-xs text-left bg-accent rounded-lg hover:bg-accent/80 transition-colors text-white"
					>
						<span class="mr-2">💡</span>
						{$t.chat.suggestion1}
					</button>
					<button
						onclick={() => setSuggestion($t.chat.suggestion2)}
						class="w-full px-3 py-2.5 text-xs text-left bg-accent rounded-lg hover:bg-accent/80 transition-colors text-white"
					>
						<span class="mr-2">🐳</span>
						{$t.chat.suggestion2}
					</button>
					<button
						onclick={() => setSuggestion($t.chat.suggestion3)}
						class="w-full px-3 py-2.5 text-xs text-left bg-accent rounded-lg hover:bg-accent/80 transition-colors text-white"
					>
						<span class="mr-2">🔍</span>
						{$t.chat.suggestion3}
					</button>
				</div>
			</div>
		{:else}
			{#each messages as message (message.id)}
				<ChatMessage {message} />
			{/each}

			{#if isLoading}
				<div class="flex items-center gap-2 text-muted-foreground text-sm">
					<div class="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
						<Loader2 class="h-4 w-4 text-primary animate-spin" />
					</div>
					<span>{$t.chat.thinking}</span>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Input -->
	<div class="p-4 border-t-2 bg-card">
		<div class="flex gap-2">
			<input
				bind:value={input}
				onkeydown={handleKeyDown}
				placeholder={$t.chat.inputPlaceholder}
				disabled={isLoading}
				class="flex-1 px-4 py-2.5 text-sm bg-background rounded-lg border-2 border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white"
				aria-label={$t.chat.inputPlaceholder}
			/>
			<Button
				onclick={sendMessage}
				disabled={isLoading || !input.trim()}
				size="icon"
				class="h-10 w-10"
				aria-label={$t.chat.send}
			>
				{#if isLoading}
					<Loader2 class="h-4 w-4 animate-spin" />
				{:else}
					<Send class="h-4 w-4" />
				{/if}
			</Button>
		</div>
		<p class="text-[10px] text-muted-foreground mt-2 text-center">
			Powered by OpenRouter • {messages.length}
			{messages.length === 1 ? 'Nachricht' : 'Nachrichten'}
		</p>
	</div>
</div>
