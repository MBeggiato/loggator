import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import Dockerode from 'dockerode';

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

export const GET: RequestHandler = async () => {
	try {
		const containers = await docker.listContainers({ all: true });
		const labelFilter = process.env.DOCKER_LABEL_FILTER || 'loggator.enable=true';
		const [labelKey, labelValue] = labelFilter.split('=');

		const filteredContainers = containers.filter((container) => {
			return container.Labels?.[labelKey] === labelValue;
		});

		const result = filteredContainers.map((container) => ({
			id: container.Id,
			shortId: container.Id.substring(0, 12),
			name: container.Names[0]?.replace(/^\//, '') || 'unknown',
			image: container.Image,
			state: container.State,
			status: container.Status,
			created: container.Created,
			labels: container.Labels
		}));

		return json({ containers: result });
	} catch (error) {
		console.error('Error listing containers:', error);
		return json({ error: 'Failed to list containers', message: String(error) }, { status: 500 });
	}
};
