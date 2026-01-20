import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import Dockerode from 'dockerode';
import { env } from '$env/dynamic/private';

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
const LABEL_FILTER = env.DOCKER_LABEL_FILTER || 'loggator.enable=true';

// SECURITY: Prüft ob Container das erforderliche Label hat
function hasRequiredLabel(labels: Record<string, string> | undefined): boolean {
	if (!labels) return false;
	const [key, value] = LABEL_FILTER.split('=');
	return labels[key] === value;
}

export const POST: RequestHandler = async ({ params }) => {
	const { id } = params;

	try {
		const container = docker.getContainer(id);

		// SECURITY: Prüfe Label BEVOR Start
		const info = await container.inspect();
		if (!hasRequiredLabel(info.Config.Labels)) {
			throw error(403, 'Container is not monitored by Loggator');
		}

		await container.start();
		const updatedInfo = await container.inspect();

		return json({
			success: true,
			message: `Container ${updatedInfo.Name.replace(/^\//, '')} started successfully`,
			state: updatedInfo.State.Status
		});
	} catch (error) {
		console.error(`Error starting container ${id}:`, error);

		if (error instanceof Error && error.message.includes('already started')) {
			return json({ error: 'Container is already running' }, { status: 400 });
		}

		return json({ error: 'Failed to start container', message: String(error) }, { status: 500 });
	}
};
