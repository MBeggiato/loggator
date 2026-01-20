<script lang="ts">
	import { MessageSquare } from 'lucide-svelte';
	import ChatWindow from './ChatWindow.svelte';

	let isOpen = $state(false);
</script>

<!-- Floating Action Button -->
{#if !isOpen}
	<button
		onclick={() => (isOpen = true)}
		class="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-transform z-50 flex items-center justify-center group"
		aria-label="KI-Assistent öffnen"
	>
		<MessageSquare class="h-6 w-6" />
		<span
			class="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full animate-pulse"
			title="KI-Assistent verfügbar"
		></span>
	</button>
{/if}

<!-- Chat Window Overlay -->
{#if isOpen}
	<ChatWindow onClose={() => (isOpen = false)} />
{/if}
