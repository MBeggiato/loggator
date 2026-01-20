import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import { tools, executeToolCall } from '$lib/server/ai-tools';
import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

// Helper function to get OpenAI client (lazy initialization)
function getOpenAIClient() {
	if (!env.OPENROUTER_API_KEY) {
		throw new Error('OPENROUTER_API_KEY environment variable is required');
	}

	return new OpenAI({
		baseURL: 'https://openrouter.ai/api/v1',
		apiKey: env.OPENROUTER_API_KEY,
		defaultHeaders: {
			'HTTP-Referer': 'http://loggator.local',
			'X-Title': 'Loggator.io'
		}
	});
}

// System Prompt
const SYSTEM_MESSAGE = {
	role: 'system' as const,
	content: `You are a helpful assistant for the Loggator Docker log analysis platform.

Your tasks:
- Analyze container logs and answer questions about them
- Use the available tools to provide precise information
- Explain errors and problems in an understandable way
- Give concrete solution suggestions

Important:
- Answer in English (unless the user asks in another language)
- Be precise and technically correct
- Quote relevant log entries using Markdown code blocks
- Provide timestamps when relevant
- ALWAYS use the tools before answering - don't guess!
- If you're uncertain, ask for more details
- Format your responses with Markdown for better readability`
};

const MAX_ITERATIONS = 5; // Verhindere Endlosschleifen
const MAX_MESSAGES = 50; // Message-History-Limit

interface ChatMessage {
	role: 'user' | 'assistant' | 'system' | 'tool';
	content: string;
	tool_call_id?: string;
	tool_calls?: any[];
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Get OpenAI client (validates API key)
		const openai = getOpenAIClient();

		const body = await request.json();
		const { messages } = body;

		// Input-Validierung
		if (!messages || !Array.isArray(messages)) {
			throw error(400, 'Invalid request: messages array required');
		}

		if (messages.length > MAX_MESSAGES) {
			throw error(400, `Too many messages. Maximum: ${MAX_MESSAGES}`);
		}

		// Message-Validierung
		for (const msg of messages) {
			if (!msg.role || !msg.content) {
				throw error(400, 'Invalid message format: role and content required');
			}
			if (msg.content.length > 10000) {
				throw error(400, 'Message too long. Maximum: 10000 characters');
			}
		}

		// Messages mit System-Prompt kombinieren
		const allMessages: ChatMessage[] = [SYSTEM_MESSAGE, ...messages];

		// Erste Anfrage an OpenRouter
		let response = await openai.chat.completions.create(
			{
				model: env.AI_MODEL || 'xiaomi/mimo-v2-flash:free',
				messages: allMessages as any,
				tools: tools as any,
				tool_choice: 'auto',
				max_tokens: 2000
			},
			{
				headers: {
					'HTTP-Referer': 'http://loggator.local',
					'X-Title': 'Loggator.io'
				}
			}
		);

		// Tool Calling Loop (OpenRouter-kompatibel)
		let iterations = 0;

		while (response.choices[0].finish_reason === 'tool_calls' && iterations < MAX_ITERATIONS) {
			iterations++;
			const toolCalls = response.choices[0].message.tool_calls;

			if (!toolCalls || toolCalls.length === 0) {
				break;
			}

			console.log(`Tool calling iteration ${iterations}, calls: ${toolCalls.length}`);

			// WICHTIG: Assistant-Message mit tool_calls hinzufügen
			allMessages.push(response.choices[0].message as any);

			// Tools parallel ausführen und Ergebnisse sammeln
			const toolResults = await Promise.all(
				toolCalls.map(async (toolCall: any) => {
					try {
						const args = JSON.parse(toolCall.function.arguments);
						const result = await executeToolCall(toolCall.function.name, args);

						return {
							role: 'tool' as const,
							tool_call_id: toolCall.id,
							content: JSON.stringify(result, null, 2)
						};
					} catch (err) {
						console.error(`Tool execution error: ${toolCall.function.name}`, err);
						return {
							role: 'tool' as const,
							tool_call_id: toolCall.id,
							content: JSON.stringify({
								success: false,
								error: err instanceof Error ? err.message : 'Unknown error'
							})
						};
					}
				})
			);

			// Tool-Ergebnisse zu Messages hinzufügen
			allMessages.push(...toolResults);

			// Nächste Anfrage mit Tool-Ergebnissen (tools-Parameter erforderlich!)
			try {
				response = await openai.chat.completions.create(
					{
						model: env.AI_MODEL || 'google/gemini-2.0-flash-thinking-exp:free',
						messages: allMessages as any,
						tools: tools as any,
						tool_choice: 'auto',
						max_tokens: 2000
					},
					{
						headers: {
							'HTTP-Referer': 'http://loggator.local',
							'X-Title': 'Loggator.io'
						}
					}
				);
			} catch (err) {
				console.error('OpenRouter API error:', err);
				// Bei Fehler mit bisherigem Response fortfahren
				break;
			}
		}

		// Warnung bei Max-Iterations
		if (iterations >= MAX_ITERATIONS) {
			console.warn(`Max iterations (${MAX_ITERATIONS}) reached for chat request`);
		}

		// Finale Antwort
		const finalMessage = response.choices[0].message;

		return json({
			success: true,
			message: finalMessage.content || 'Keine Antwort generiert',
			toolCalls: finalMessage.tool_calls || [],
			iterations,
			model: response.model,
			usage: response.usage
		});
	} catch (err) {
		console.error('Chat API error:', err);

		// OpenAI SDK Fehler
		if (err instanceof OpenAI.APIError) {
			return json(
				{
					success: false,
					error: err.message,
					code: err.status
				},
				{ status: err.status || 500 }
			);
		}

		// SvelteKit error
		if (typeof err === 'object' && err !== null && 'status' in err) {
			throw err;
		}

		// Generischer Fehler
		return json(
			{
				success: false,
				error: err instanceof Error ? err.message : 'Internal server error'
			},
			{ status: 500 }
		);
	}
};
