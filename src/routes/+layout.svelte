<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import logo from '$lib/assets/logo.png';
	import { Toaster } from 'svelte-sonner';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={logo} />
	<title>Loggator - Docker Log Aggregator</title>
</svelte:head>

<div class="dark">
	<Toaster richColors position="top-right" />
	{@render children()}
</div>
