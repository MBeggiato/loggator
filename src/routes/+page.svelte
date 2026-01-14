<script lang="ts">
	import LogViewer from '$lib/components/LogViewer.svelte';
</script>

<main class="container">
	<header>
		<h1>🔍 Loggator - Docker Log Aggregator</h1>
		<p>Zentrale Log-Überwachung und -Durchsuchung für Docker Container</p>
	</header>

	<LogViewer />
</main>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
		background: #0f1419;
		color: #c9d1d9;
	}

	.container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		margin-bottom: 2rem;
		text-align: center;
	}

	h1 {
		font-size: 2.5rem;
		margin: 0 0 0.5rem 0;
		color: #58a6ff;
	}

	header p {
		margin: 0;
		color: #8b949e;
	}

	:global(*) {
		box-sizing: border-box;
	}
</style>
