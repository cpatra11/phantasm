import type { AgentEvent } from './types';

/** Reads the agent's NDJSON stream line by line. Client-side only. */
export async function readAgentStream(res: Response, onEvent: (e: AgentEvent) => void): Promise<void> {
  if (!res.body) throw new Error('Empty response from the agent');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx = buffer.indexOf('\n');
    while (idx >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line) onEvent(JSON.parse(line) as AgentEvent);
      idx = buffer.indexOf('\n');
    }
  }
}
