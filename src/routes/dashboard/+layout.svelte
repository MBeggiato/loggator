<script lang="ts">
	import {
		LayoutDashboard,
		Search,
		Container,
		Activity,
		Settings,
		ChevronLeft,
		ChevronRight
	} from 'lucide-svelte';
	import { Button, Separator } from '$lib/components/ui';
	import { page } from '$app/stores';
	import logo from '$lib/assets/logo.png';
	import { version } from '../../../package.json';

	let { children } = $props();

	let collapsed = $state(false);

	const navItems = [
		{ href: '/dashboard', label: 'Übersicht', icon: LayoutDashboard },
		{ href: '/dashboard/containers', label: 'Container', icon: Container },
		{ href: '/dashboard/search', label: 'Log-Suche', icon: Search },
		{ href: '/dashboard/live', label: 'Live-Logs', icon: Activity }
	];
</script>

<div class="flex h-screen bg-background">
	<!-- Sidebar -->
	<aside
		class="flex flex-col border-r bg-sidebar transition-all duration-300 {collapsed
			? 'w-16'
			: 'w-64'}"
	>
		<!-- Logo -->
		<div class="flex h-16 items-center gap-3 border-b px-4">
			<img src={logo} alt="Loggator Logo" class="h-10 w-10 shrink-0 rounded-lg" />
			{#if !collapsed}
				<span class="font-semibold text-sidebar-foreground">Loggator</span>
			{/if}
		</div>

		<!-- Navigation -->
		<nav class="flex-1 space-y-1 p-2">
			{#each navItems as item}
				{@const isActive = $page.url.pathname === item.href}
				<a
					href={item.href}
					class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors
						{isActive
						? 'bg-sidebar-accent text-sidebar-accent-foreground'
						: 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}"
					title={collapsed ? item.label : undefined}
				>
					<item.icon class="h-4 w-4 shrink-0" />
					{#if !collapsed}
						<span>{item.label}</span>
					{/if}
				</a>
			{/each}
		</nav>

		<Separator />

		<!-- Collapse button -->
		<div class="p-2">
			<Button
				variant="ghost"
				size={collapsed ? 'icon' : 'default'}
				class="w-full justify-center"
				onclick={() => (collapsed = !collapsed)}
			>
				{#if collapsed}
					<ChevronRight class="h-4 w-4" />
				{:else}
					<ChevronLeft class="h-4 w-4" />
					<span>Einklappen</span>
				{/if}
			</Button>
		</div>

		<!-- Version -->
		<div class="border-t px-4 py-3 text-center">
			<span class="text-xs text-muted-foreground">
				{#if collapsed}
					v{version}
				{:else}
					Version {version}
				{/if}
			</span>
		</div>
	</aside>

	<!-- Main content -->
	<main class="flex-1 overflow-auto">
		{@render children()}
	</main>
</div>
