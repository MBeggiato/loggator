import { MeiliSearch } from 'meilisearch';
import Dockerode from 'dockerode';
import { env } from '$env/dynamic/private';

const meilisearchClient = new MeiliSearch({
	host: env.MEILISEARCH_HOST || 'http://meilisearch:7700',
	apiKey: env.MEILISEARCH_API_KEY || ''
});

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

// Label-Filter für Security (nur überwachte Container)
const LABEL_FILTER = env.DOCKER_LABEL_FILTER || 'loggator.enable=true';

/**
 * Prüft ob ein Container das erforderliche Label hat
 * SECURITY: Dies verhindert, dass die KI auf nicht-überwachte Container zugreifen kann
 */
function hasRequiredLabel(labels: Record<string, string> | undefined): boolean {
	if (!labels) return false;
	const [key, value] = LABEL_FILTER.split('=');
	return labels[key] === value;
}

/**
 * Filtert Container nach dem erforderlichen Label
 * SECURITY: Gibt nur Container zurück, die auch überwacht werden
 */
function filterMonitoredContainers(
	containers: Dockerode.ContainerInfo[]
): Dockerode.ContainerInfo[] {
	return containers.filter((c) => hasRequiredLabel(c.Labels));
}

// Tool Definitionen für OpenRouter
export const tools = [
	{
		type: 'function' as const,
		function: {
			name: 'search_logs',
			description:
				'Durchsucht Container-Logs mit Volltextsuche und Filtern. Nutze dies um spezifische Log-Einträge zu finden wie Errors, Warnings oder bestimmte Events.',
			parameters: {
				type: 'object',
				properties: {
					query: {
						type: 'string',
						description:
							"Suchbegriff für Volltextsuche (z.B. 'error', 'failed', 'timeout', 'exception')"
					},
					container: {
						type: 'string',
						description: 'Container-Name zum Filtern (optional)'
					},
					stream: {
						type: 'string',
						enum: ['stdout', 'stderr'],
						description: 'Log-Stream filtern: stdout oder stderr (optional)'
					},
					limit: {
						type: 'number',
						description: 'Maximale Anzahl Ergebnisse (default: 50, max: 100)'
					}
				},
				required: ['query']
			}
		}
	},
	{
		type: 'function' as const,
		function: {
			name: 'get_container_info',
			description:
				'Liefert aktuelle Informationen zu einem überwachten Container (Status, Image, Uptime, Ports, etc.). Nur Container mit loggator.enable=true Label sind verfügbar.',
			parameters: {
				type: 'object',
				properties: {
					containerName: {
						type: 'string',
						description: 'Name oder ID des Containers (ohne leading /)'
					}
				},
				required: ['containerName']
			}
		}
	},
	{
		type: 'function' as const,
		function: {
			name: 'analyze_container_health',
			description:
				'Analysiert die Gesundheit eines Containers anhand seiner Logs (Errors, Warnings, Muster)',
			parameters: {
				type: 'object',
				properties: {
					containerName: {
						type: 'string',
						description: 'Name des Containers'
					},
					minutes: {
						type: 'number',
						description: 'Zeitfenster in Minuten (default: 60, max: 1440 = 24h)'
					}
				},
				required: ['containerName']
			}
		}
	},
	{
		type: 'function' as const,
		function: {
			name: 'list_containers',
			description:
				'Listet alle überwachten Container (mit loggator.enable=true Label) mit Status auf',
			parameters: {
				type: 'object',
				properties: {
					all: {
						type: 'boolean',
						description: 'Zeige auch gestoppte Container (default: false)'
					}
				}
			}
		}
	}
];

// Tool Execution Functions
interface SearchLogsParams {
	query: string;
	container?: string;
	stream?: 'stdout' | 'stderr';
	limit?: number;
}

export async function searchLogs(params: SearchLogsParams) {
	try {
		const filters: string[] = [];

		if (params.container) {
			// SECURITY: Escape quotes to prevent filter injection
			const escapedContainer = params.container.replace(/"/g, '\\"');
			filters.push(`containerName = "${escapedContainer}"`);
		}

		if (params.stream) {
			// Only allow known values
			if (params.stream === 'stdout' || params.stream === 'stderr') {
				filters.push(`stream = "${params.stream}"`);
			}
		const results = await index.search(params.query, {
			filter: filters.length > 0 ? filters.join(' AND ') : undefined,
			limit,
			sort: ['timestamp:desc']
		});

		return {
			success: true,
			total: results.estimatedTotalHits,
			returned: results.hits.length,
			logs: results.hits.map((hit: any) => ({
				container: hit.containerName,
				message: hit.message,
				stream: hit.stream,
				timestamp: hit.timestampISO || new Date(hit.timestamp).toISOString(),
				id: hit.id
			}))
		};
	} catch (error) {
		console.error('searchLogs error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
			logs: []
		};
	}
}

interface ContainerInfoParams {
	containerName: string;
}

export async function getContainerInfo(params: ContainerInfoParams) {
	try {
		const containers = await docker.listContainers({ all: true });

		// SECURITY: Nur überwachte Container durchsuchen
		const monitoredContainers = filterMonitoredContainers(containers);

		const containerInfo = monitoredContainers.find(
			(c) =>
				c.Names.some((name) => name.replace(/^\//, '') === params.containerName) ||
				c.Id.startsWith(params.containerName)
		);

		if (!containerInfo) {
			return {
				success: false,
				error: `Container '${params.containerName}' nicht gefunden oder wird nicht überwacht`
			};
		}

		const container = docker.getContainer(containerInfo.Id);
		const inspect = await container.inspect();

		// SECURITY: Nochmal prüfen ob Container das Label hat
		if (!hasRequiredLabel(inspect.Config.Labels)) {
			return {
				success: false,
				error: `Container '${params.containerName}' wird nicht überwacht`
			};
		}

		return {
			success: true,
			container: {
				id: containerInfo.Id.substring(0, 12),
				name: containerInfo.Names[0]?.replace(/^\//, '') || 'unknown',
				image: containerInfo.Image,
				state: containerInfo.State,
				status: containerInfo.Status,
				created: new Date(inspect.Created).toISOString(),
				ports: containerInfo.Ports.map((p) => ({
					private: p.PrivatePort,
					public: p.PublicPort,
					type: p.Type
				})),
				labels: inspect.Config.Labels || {},
				restartCount: inspect.RestartCount,
				exitCode: inspect.State.ExitCode
			}
		};
	} catch (error) {
		console.error('getContainerInfo error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

interface AnalyzeHealthParams {
	containerName: string;
	minutes?: number;
}

export async function analyzeContainerHealth(params: AnalyzeHealthParams) {
	try {
		const minutes = Math.min(params.minutes || 60, 1440);
		const startTime = Date.now() - minutes * 60 * 1000;

		const index = meilisearchClient.index('logs');

		// Parallel Fehler und Warnings zählen
		const [errorResults, totalResults] = await Promise.all([
			// Fehler-Patterns suchen
			index.search('error OR exception OR fail OR crash OR fatal', {
				filter: `containerName = "${params.containerName}" AND timestamp >= ${startTime}`,
				limit: 10,
				sort: ['timestamp:desc']
			}),
			// Alle Logs zählen
			index.search('', {
				filter: `containerName = "${params.containerName}" AND timestamp >= ${startTime}`,
				limit: 0
			})
		]);

		// Container-Status abrufen
		const containerInfo = await getContainerInfo({ containerName: params.containerName });

		return {
			success: true,
			containerName: params.containerName,
			timeWindow: `${minutes} Minuten`,
			analysis: {
				totalLogs: totalResults.estimatedTotalHits,
				errorLogs: errorResults.estimatedTotalHits,
				errorRate:
					totalResults.estimatedTotalHits > 0
						? ((errorResults.estimatedTotalHits / totalResults.estimatedTotalHits) * 100).toFixed(
								2
							) + '%'
						: '0%',
				containerState: containerInfo.success ? containerInfo.container?.state : 'unknown',
				recentErrors: errorResults.hits.map((hit: any) => ({
					message: hit.message,
					timestamp: hit.timestampISO || new Date(hit.timestamp).toISOString(),
					stream: hit.stream
				}))
			}
		};
	} catch (error) {
		console.error('analyzeContainerHealth error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

interface ListContainersParams {
	all?: boolean;
}

export async function listContainers(params: ListContainersParams = {}) {
	try {
		const containers = await docker.listContainers({ all: params.all || false });

		// SECURITY: Nur überwachte Container zurückgeben
		const monitoredContainers = filterMonitoredContainers(containers);

		return {
			success: true,
			total: monitoredContainers.length,
			containers: monitoredContainers.map((c) => ({
				id: c.Id.substring(0, 12),
				name: c.Names[0]?.replace(/^\//, '') || 'unknown',
				image: c.Image,
				state: c.State,
				status: c.Status,
				created: new Date(c.Created * 1000).toISOString()
			}))
		};
	} catch (error) {
		console.error('listContainers error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
			containers: []
		};
	}
}

// Tool Executor
export async function executeToolCall(toolName: string, args: any): Promise<any> {
	console.log(`Executing tool: ${toolName}`, args);

	try {
		switch (toolName) {
			case 'search_logs':
				return await searchLogs(args);
			case 'get_container_info':
				return await getContainerInfo(args);
			case 'analyze_container_health':
				return await analyzeContainerHealth(args);
			case 'list_containers':
				return await listContainers(args);
			default:
				return {
					success: false,
					error: `Unknown tool: ${toolName}`
				};
		}
	} catch (error) {
		console.error(`Tool execution error for ${toolName}:`, error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}
