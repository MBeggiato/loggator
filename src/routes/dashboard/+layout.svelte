<script lang="ts">
	import {
		LayoutDashboard,
		Search,
		Container,
		Activity,
		ChevronLeft,
		ChevronRight,
		Github,
		Info,
		ExternalLink,
		Languages
	} from 'lucide-svelte';
	import {
		Button,
		Separator,
		Tooltip,
		TooltipContent,
		TooltipTrigger,
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from '$lib/components/ui';
	import { page } from '$app/stores';
	import logo from '$lib/assets/logo.png';
	import { version } from '../../../package.json';
	import { t, locale, availableLocales, type Locale } from '$lib/i18n';

	let { children } = $props();

	let collapsed = $state(false);
	let latestVersion = $state<string | null>(null);
	let updateAvailable = $derived(
		latestVersion && latestVersion !== version && compareVersions(latestVersion, version) > 0
	);

	// Navigation items with translation keys
	const navItems = [
		{ href: '/dashboard', labelKey: 'overview' as const, icon: LayoutDashboard },
		{ href: '/dashboard/containers', labelKey: 'containers' as const, icon: Container },
		{ href: '/dashboard/search', labelKey: 'logSearch' as const, icon: Search },
		{ href: '/dashboard/live', labelKey: 'liveLogs' as const, icon: Activity }
	];

	const GITHUB_REPO = 'https://github.com/MBeggiato/loggator';

	function compareVersions(a: string, b: string): number {
		const partsA = a.replace(/^v/, '').split('.').map(Number);
		const partsB = b.replace(/^v/, '').split('.').map(Number);

		for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
			const numA = partsA[i] || 0;
			const numB = partsB[i] || 0;
			if (numA > numB) return 1;
			if (numA < numB) return -1;
		}
		return 0;
	}

	async function checkForUpdates() {
		try {
			const res = await fetch('https://api.github.com/repos/MBeggiato/loggator/releases/latest');
			if (res.ok) {
				const data = await res.json();
				latestVersion = data.tag_name?.replace(/^v/, '') || null;
			}
		} catch (error) {
			console.error('Failed to check for updates:', error);
		}
	}

	function setLocale(newLocale: Locale) {
		locale.set(newLocale);
	}

	$effect(() => {
		checkForUpdates();
		const interval = setInterval(checkForUpdates, 30 * 60 * 1000);
		return () => clearInterval(interval);
	});
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
				{@const label = $t.nav[item.labelKey]}
				<a
					href={item.href}
					class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors
						{isActive
						? 'bg-sidebar-accent text-sidebar-accent-foreground'
						: 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}"
					title={collapsed ? label : undefined}
				>
					<item.icon class="h-4 w-4 shrink-0" />
					{#if !collapsed}
						<span>{label}</span>
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
					<span>{$t.nav.collapse}</span>
				{/if}
			</Button>
		</div>

		<!-- Footer: Version, Language & GitHub -->
		<div class="border-t px-3 py-3 space-y-2">
			<!-- Version with Update indicator -->
			<div class="flex items-center justify-center gap-2">
				{#if collapsed}
					{#if updateAvailable}
						<Tooltip>
							<TooltipTrigger>
								<a
									href="{GITHUB_REPO}/releases/latest"
									target="_blank"
									rel="noopener noreferrer"
									class="flex items-center text-amber-500 hover:text-amber-400 transition-colors"
								>
									<Info class="h-4 w-4" />
								</a>
							</TooltipTrigger>
							<TooltipContent side="right">
								<p>{$t.common.updateAvailable}: v{latestVersion}</p>
							</TooltipContent>
						</Tooltip>
					{:else}
						<span class="text-xs text-muted-foreground">v{version}</span>
					{/if}
				{:else}
					<span class="text-xs text-muted-foreground">{$t.common.version} {version}</span>
					{#if updateAvailable}
						<Tooltip>
							<TooltipTrigger>
								<a
									href="{GITHUB_REPO}/releases/latest"
									target="_blank"
									rel="noopener noreferrer"
									class="flex items-center text-amber-500 hover:text-amber-400 transition-colors"
								>
									<Info class="h-4 w-4" />
								</a>
							</TooltipTrigger>
							<TooltipContent>
								<p>{$t.common.updateAvailable}: v{latestVersion}</p>
							</TooltipContent>
						</Tooltip>
					{/if}
				{/if}
			</div>

			<!-- Language Selector -->
			<DropdownMenu>
				<DropdownMenuTrigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="ghost"
							size={collapsed ? 'icon' : 'sm'}
							class="w-full justify-center gap-2"
						>
							<Languages class="h-4 w-4" />
							{#if !collapsed}
								<span class="text-xs"
									>{availableLocales.find((l) => l.code === $locale)?.flag}
									{availableLocales.find((l) => l.code === $locale)?.name}</span
								>
							{/if}
						</Button>
					{/snippet}
				</DropdownMenuTrigger>
				<DropdownMenuContent side={collapsed ? 'right' : 'top'} align="center">
					{#each availableLocales as loc}
						<DropdownMenuItem
							onclick={() => setLocale(loc.code)}
							class="gap-2 {$locale === loc.code ? 'bg-accent' : ''}"
						>
							<span>{loc.flag}</span>
							<span>{loc.name}</span>
						</DropdownMenuItem>
					{/each}
				</DropdownMenuContent>
			</DropdownMenu>

			<!-- GitHub Link -->
			<a
				href={GITHUB_REPO}
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
				title={collapsed ? 'GitHub Repository' : undefined}
			>
				<Github class="h-4 w-4 shrink-0" />
				{#if !collapsed}
					<span>GitHub</span>
					<ExternalLink class="h-3 w-3" />
				{/if}
			</a>
		</div>
	</aside>

	<!-- Main content -->
	<main class="flex-1 overflow-auto">
		{@render children()}
	</main>
</div>
