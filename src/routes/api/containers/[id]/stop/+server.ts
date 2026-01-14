import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import Dockerode from 'dockerode';

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

export const POST: RequestHandler = async ({ params }) => {
	const { id } = params;

	try {
		const container = docker.getContainer(id);
		await container.stop();

		const info = await container.inspect();

		return json({
			success: true,
			message: `Container ${info.Name.replace(/^\//, '')} stopped successfully`,
			state: info.State.Status
		});
	} catch (error) {
		console.error(`Error stopping container ${id}:`, error);

		if (error instanceof Error && error.message.includes('already stopped')) {
			return json({ error: 'Container is already stopped' }, { status: 400 });
		}

		return json({ error: 'Failed to stop container', message: String(error) }, { status: 500 });
	}
};
