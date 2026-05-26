import type { ProviderConfigInput } from "./provider-client.js";
import { requestProviderText } from "./provider-client.js";

export type FunctionSummaryItem = {
  name: string;
  line: number;
  sourceFile: string;
  snippet: string;
  summary: string;
  source: "provider" | "fallback";
};

function fallbackSummary(name: string) {
  return `Handles ${name} logic for this page flow.`;
}

function trimSnippet(snippet: string) {
  return snippet.replace(/\s+/g, " ").trim().slice(0, 360);
}

export async function summarizeFunctionsWithProvider(input: {
  providerConfig: ProviderConfigInput;
  handlers: Array<{ name: string; line: number; sourceFile: string; snippet: string }>;
  invokeProvider?: (prompt: string) => Promise<string>;
}): Promise<FunctionSummaryItem[]> {
  const invoke =
    input.invokeProvider ??
    ((prompt: string) => requestProviderText(input.providerConfig, prompt));

  const items: FunctionSummaryItem[] = [];
  for (const handler of input.handlers) {
    const prompt = [
      "Summarize this frontend function in one concise sentence for onboarding.",
      "Focus on user intent and side effects. No markdown. 22 words max.",
      `functionName=${handler.name}`,
      `file=${handler.sourceFile}`,
      `line=${handler.line}`,
      `snippet=${trimSnippet(handler.snippet)}`,
    ].join("\n");

    try {
      const raw = await invoke(prompt);
      const summary = String(raw ?? "").replace(/\s+/g, " ").trim();
      items.push({
        ...handler,
        summary: summary || fallbackSummary(handler.name),
        source: summary ? "provider" : "fallback",
      });
    } catch {
      items.push({
        ...handler,
        summary: fallbackSummary(handler.name),
        source: "fallback",
      });
    }
  }
  return items;
}

