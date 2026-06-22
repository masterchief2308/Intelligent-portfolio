export type SseHandler = (event: Record<string, unknown>) => void;

/** Read an SSE response body and invoke handler for each parsed `data:` JSON payload. */
export async function consumeSseStream(
  response: Response,
  onEvent: SseHandler,
): Promise<void> {
  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr) continue;
      try {
        onEvent(JSON.parse(jsonStr) as Record<string, unknown>);
      } catch {
        // ignore partial JSON
      }
    }
  }
}
