<script lang="ts">
	import { Badge } from '$lib/components/ui';
	import { Bot, User, Wrench } from 'lucide-svelte';
	import { marked } from 'marked';
	import hljs from 'highlight.js/lib/core';
	import javascript from 'highlight.js/lib/languages/javascript';
	import typescript from 'highlight.js/lib/languages/typescript';
	import python from 'highlight.js/lib/languages/python';
	import bash from 'highlight.js/lib/languages/bash';
	import json from 'highlight.js/lib/languages/json';
	import yaml from 'highlight.js/lib/languages/yaml';

	// Register languages
	hljs.registerLanguage('javascript', javascript);
	hljs.registerLanguage('typescript', typescript);
	hljs.registerLanguage('python', python);
	hljs.registerLanguage('bash', bash);
	hljs.registerLanguage('json', json);
	hljs.registerLanguage('yaml', yaml);

	interface Props {
		message: {
			role: 'user' | 'assistant';
			content: string;
			timestamp: Date;
			toolCalls?: any[];
		};
	}

	let { message }: Props = $props();

	// Configure marked with syntax highlighting
	marked.setOptions({
		highlight: (code, lang) => {
			if (lang && hljs.getLanguage(lang)) {
				try {
					return hljs.highlight(code, { language: lang }).value;
				} catch (err) {
					console.error('Highlight error:', err);
				}
			}
			return code;
		},
		breaks: true,
		gfm: true
	});

	let renderedContent = $derived(
		message.role === 'assistant' ? marked.parse(message.content) : message.content
	);
</script>

<div class="flex gap-3 {message.role === 'user' ? 'justify-end' : ''}">
	{#if message.role === 'assistant'}
		<div class="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1">
			<Bot class="h-4 w-4 text-primary" />
		</div>
	{/if}

	<div class="max-w-[85%]">
		<div
			class="rounded-lg p-4 {message.role === 'user'
				? 'bg-primary text-primary-foreground ml-auto'
				: 'bg-muted border border-border text-foreground shadow-sm'}"
		>
			<div class="prose prose-sm dark:prose-invert max-w-none markdown-content">
				{@html renderedContent}
			</div>
		</div>

		{#if message.toolCalls && message.toolCalls.length > 0}
			<div class="mt-1.5 flex flex-wrap gap-1">
				{#each message.toolCalls as tool}
					<Badge variant="outline" class="text-xs">
						<Wrench class="h-3 w-3 mr-1" />
						{tool.function.name}
					</Badge>
				{/each}
			</div>
		{/if}

		<div
			class="text-[10px] text-muted-foreground mt-1 {message.role === 'user' ? 'text-right' : ''}"
		>
			{message.timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
		</div>
	</div>

	{#if message.role === 'user'}
		<div class="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
			<User class="h-4 w-4" />
		</div>
	{/if}
</div>
