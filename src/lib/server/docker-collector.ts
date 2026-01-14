import Dockerode from 'dockerode';
import type { Container } from 'dockerode';
import { PassThrough } from 'stream';

export interface LogEntry {
	containerId: string;
	containerName: string;
	timestamp: Date;
	message: string;
	stream: 'stdout' | 'stderr';
	labels: Record<string, string>;
}

export type LogCallback = (log: LogEntry) => void;

interface MonitoredContainer {
	stream: NodeJS.ReadableStream;
	stdoutStream: PassThrough;
	stderrStream: PassThrough;
}

export class DockerLogCollector {
	private docker: Dockerode;
	private monitoredContainers: Map<string, MonitoredContainer> = new Map();
	private logCallback: LogCallback;
	private labelFilter: string;

	constructor(labelFilter: string = 'loggator.enable=true', logCallback: LogCallback) {
		this.docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
		this.labelFilter = labelFilter;
		this.logCallback = logCallback;
	}

	async start(): Promise<void> {
		console.log('Starting Docker Log Collector...');
		await this.discoverContainers();
		this.listenToDockerEvents();
	}

	private async discoverContainers(): Promise<void> {
		try {
			const containers = await this.docker.listContainers();
			for (const containerInfo of containers) {
				await this.checkAndMonitorContainer(containerInfo.Id);
			}
			console.log(`Discovered ${this.monitoredContainers.size} containers to monitor`);
		} catch (error) {
			console.error('Error discovering containers:', error);
		}
	}

	private async checkAndMonitorContainer(containerId: string): Promise<void> {
		try {
			const container = this.docker.getContainer(containerId);
			const info = await container.inspect();

			if (this.shouldMonitor(info.Config.Labels || {})) {
				if (!this.monitoredContainers.has(containerId)) {
					await this.monitorContainer(container, info);
				}
			}
		} catch (error) {
			console.error(`Error checking container ${containerId}:`, error);
		}
	}

	private shouldMonitor(labels: Record<string, string>): boolean {
		const [key, value] = this.labelFilter.split('=');
		return labels[key] === value;
	}

	private async monitorContainer(
		container: Container,
		info: Dockerode.ContainerInspectInfo
	): Promise<void> {
		const containerId = info.Id;
		const containerName = info.Name.replace(/^\//, '');
		const labels = info.Config.Labels || {};

		console.log(
			`Starting to monitor container: ${containerName} (${containerId.substring(0, 12)})`
		);

		try {
			const logStream = await container.logs({
				follow: true,
				stdout: true,
				stderr: true,
				timestamps: true,
				tail: 100 // Letzte 100 Zeilen beim Start
			});

			// Erstelle separate Streams für stdout und stderr
			const stdoutStream = new PassThrough();
			const stderrStream = new PassThrough();

			// dockerode demuxStream nutzen um stdout/stderr zu trennen
			container.modem.demuxStream(logStream, stdoutStream, stderrStream);

			// Verarbeite stdout
			let stdoutBuffer = '';
			stdoutStream.on('data', (chunk: Buffer) => {
				stdoutBuffer += chunk.toString('utf8');
				const lines = stdoutBuffer.split('\n');
				stdoutBuffer = lines.pop() || '';

				for (const line of lines) {
					if (line.trim()) {
						this.parseAndEmitLog(line, containerId, containerName, labels, 'stdout');
					}
				}
			});

			// Verarbeite stderr
			let stderrBuffer = '';
			stderrStream.on('data', (chunk: Buffer) => {
				stderrBuffer += chunk.toString('utf8');
				const lines = stderrBuffer.split('\n');
				stderrBuffer = lines.pop() || '';

				for (const line of lines) {
					if (line.trim()) {
						this.parseAndEmitLog(line, containerId, containerName, labels, 'stderr');
					}
				}
			});

			logStream.on('error', (error) => {
				console.error(`Error streaming logs from ${containerName}:`, error);
			});

			logStream.on('end', () => {
				console.log(`Log stream ended for ${containerName}`);
				this.stopMonitoring(containerId);
			});

			this.monitoredContainers.set(containerId, {
				stream: logStream,
				stdoutStream,
				stderrStream
			});
		} catch (error) {
			console.error(`Error monitoring container ${containerName}:`, error);
		}
	}

	private parseAndEmitLog(
		line: string,
		containerId: string,
		containerName: string,
		labels: Record<string, string>,
		stream: 'stdout' | 'stderr'
	): void {
		// Parse Timestamp wenn vorhanden (mit timestamps: true Option)
		const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(.*)$/);
		let timestamp = new Date();
		let message = line;

		if (timestampMatch) {
			timestamp = new Date(timestampMatch[1]);
			message = timestampMatch[2];
		}

		const logEntry: LogEntry = {
			containerId,
			containerName,
			timestamp,
			message: message.trim(),
			stream,
			labels
		};

		this.logCallback(logEntry);
	}

	private listenToDockerEvents(): void {
		this.docker.getEvents((err, stream) => {
			if (err) {
				console.error('Error listening to Docker events:', err);
				return;
			}

			if (!stream) return;

			// Buffer für unvollständige JSON-Strings
			let eventBuffer = '';

			stream.on('data', async (chunk: Buffer) => {
				try {
					eventBuffer += chunk.toString();
					const lines = eventBuffer.split('\n');
					// Behalte letzten unvollständigen Teil im Buffer
					eventBuffer = lines.pop() || '';

					for (const line of lines) {
						if (!line.trim()) continue;

						try {
							const event = JSON.parse(line);

							if (event.Type === 'container') {
								if (event.Action === 'start') {
									await this.checkAndMonitorContainer(event.id);
								} else if (event.Action === 'die' || event.Action === 'stop') {
									this.stopMonitoring(event.id);
								}
							}
						} catch (parseError) {
							console.error('Error parsing Docker event line:', parseError);
						}
					}
				} catch (error) {
					console.error('Error processing Docker events:', error);
				}
			});
		});

		console.log('Listening to Docker events...');
	}

	private stopMonitoring(containerId: string): void {
		const monitored = this.monitoredContainers.get(containerId);
		if (monitored) {
			// Cleanup: Streams beenden
			try {
				if ('destroy' in monitored.stream) {
					(monitored.stream as any).destroy();
				}
				monitored.stdoutStream.destroy();
				monitored.stderrStream.destroy();
			} catch (error) {
				// Ignoriere Fehler beim Stream-Cleanup
			}
			this.monitoredContainers.delete(containerId);
			console.log(`Stopped monitoring container: ${containerId.substring(0, 12)}`);
		}
	}

	stop(): void {
		console.log('Stopping Docker Log Collector...');
		for (const [containerId] of this.monitoredContainers) {
			this.stopMonitoring(containerId);
		}
	}
}
