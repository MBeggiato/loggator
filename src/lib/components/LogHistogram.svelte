<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		Chart as ChartJS,
		Title,
		Tooltip,
		Legend,
		BarElement,
		BarController,
		CategoryScale,
		LinearScale,
		type ChartOptions
	} from 'chart.js';

	// Chart.js Komponenten registrieren (BarController ist wichtig!)
	ChartJS.register(Title, Tooltip, Legend, BarElement, BarController, CategoryScale, LinearScale);

	interface HistogramData {
		minute: string;
		count: number;
		timestamp: number;
	}

	let { data = [] }: { data: HistogramData[] } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let chart: ChartJS<'bar'> | null = null;

	const options: ChartOptions<'bar'> = {
		responsive: true,
		maintainAspectRatio: false,
		animation: {
			duration: 300
		},
		plugins: {
			legend: {
				display: false
			},
			title: {
				display: false
			},
			tooltip: {
				backgroundColor: '#1a1a1a',
				titleColor: '#fafafa',
				bodyColor: '#fafafa',
				borderColor: '#3f3f46',
				borderWidth: 1,
				padding: 12,
				cornerRadius: 8,
				displayColors: false,
				callbacks: {
					label: (context) => `${context.parsed.y ?? 0} Logs`
				}
			}
		},
		scales: {
			x: {
				grid: {
					display: false
				},
				ticks: {
					color: '#a1a1aa',
					maxRotation: 45,
					minRotation: 0,
					autoSkip: true,
					maxTicksLimit: 12
				},
				border: {
					display: false
				}
			},
			y: {
				beginAtZero: true,
				grid: {
					color: 'rgba(63, 63, 70, 0.5)'
				},
				ticks: {
					color: '#a1a1aa',
					precision: 0
				},
				border: {
					display: false
				}
			}
		}
	};

	function createChart() {
		if (!canvas) return;

		const chartData = {
			labels: data.map((d) => d.minute),
			datasets: [
				{
					label: 'Logs pro Minute',
					data: data.map((d) => d.count),
					backgroundColor: 'rgba(99, 102, 241, 0.8)',
					borderColor: 'rgb(99, 102, 241)',
					borderWidth: 1,
					borderRadius: 4,
					barPercentage: 0.8,
					categoryPercentage: 0.9
				}
			]
		};

		if (chart) {
			chart.data = chartData;
			chart.update('none');
		} else {
			chart = new ChartJS(canvas, {
				type: 'bar',
				data: chartData,
				options
			});
		}
	}

	onMount(() => {
		// Warte bis Canvas verfügbar ist
		setTimeout(() => {
			createChart();
		}, 100);
	});

	onDestroy(() => {
		if (chart) {
			chart.destroy();
			chart = null;
		}
	});

	// Reagiere auf Datenänderungen
	$effect(() => {
		if (data && canvas) {
			createChart();
		}
	});
</script>

<div class="h-full w-full min-h-[200px]">
	<canvas bind:this={canvas}></canvas>
	{#if data.length === 0}
		<div class="absolute inset-0 flex items-center justify-center text-muted-foreground">
			Keine Daten verfügbar
		</div>
	{/if}
</div>
