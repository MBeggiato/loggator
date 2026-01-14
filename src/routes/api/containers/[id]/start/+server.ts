import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import Dockerode from 'dockerode';

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

export const POST: RequestHandler = async ({ params }) => {
	const { id } = params;

	try {
		const container = docker.getContainer(id);
		await container.start();

		const info = await container.inspect();

		return json({
			success: true,
			message: `Container ${info.Name.replace(/^\//, '')} started successfully`,
			state: info.State.Status
		});
	} catch (error) {
		console.error(`Error starting container ${id}:`, error);

		if (error instanceof Error && error.message.includes('already started')) {
			return json({ error: 'Container is already running' }, { status: 400 });
		}

		return json({ error: 'Failed to start container', message: String(error) }, { status: 500 });
	}
};
