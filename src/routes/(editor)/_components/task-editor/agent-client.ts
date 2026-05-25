import type { AgentResult } from "../task-editor-model";

function readAgentEvent(block: string) {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }

  if (dataLines.length === 0) return undefined;
  return { event, data: JSON.parse(dataLines.join("\n")) as AgentResult & { message?: string } };
}

export async function readAgentResponse(response: Response, onStatus: (message: string) => void): Promise<AgentResult> {
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message || "Agent failed to update task");
  }

  if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
    return (await response.json()) as AgentResult;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: AgentResult | undefined;

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const parsed = readAgentEvent(chunk);
      if (!parsed) continue;
      if (parsed.event === "status" && parsed.data.message) {
        onStatus(parsed.data.message);
      } else if (parsed.event === "result") {
        finalResult = parsed.data;
      } else if (parsed.event === "error") {
        throw new Error(parsed.data.message || "Agent failed to update task");
      }
    }

    if (done) break;
  }

  if (!finalResult) throw new Error("Agent did not return file edits.");
  return finalResult;
}
