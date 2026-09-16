import type { ParseEvent } from './types';

function parseLine(line: string): ParseEvent | null {
  if (!line.trim()) {
    return null;
  }
  try {
    return JSON.parse(line) as ParseEvent;
  } catch {
    return null;
  }
}

async function* readEvents(res: Response): AsyncGenerator<ParseEvent> {
  if (!res.body) {
    for (const line of (await res.text()).split('\n')) {
      const event = parseLine(line);
      if (event) {
        yield event;
      }
    }
    return;
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += value;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const event = parseLine(line);
      if (event) {
        yield event;
      }
    }
  }

  const last = parseLine(buffer);
  if (last) {
    yield last;
  }
}

export { readEvents };
