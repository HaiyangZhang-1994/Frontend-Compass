export type ProviderConfigInput = {
  baseURL: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
};

export type NormalizedProviderConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
};

export type ChatCompletionsRequestBody = {
  model: string;
  temperature?: number;
  max_tokens?: number;
  messages: Array<{
    role: "user";
    content: string;
  }>;
};

export function normalizeProviderConfig(
  input: ProviderConfigInput,
): NormalizedProviderConfig {
  return {
    baseURL: input.baseURL.replace(/\/+$/, ""),
    apiKey: input.apiKey,
    model: input.model,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
  };
}

export function buildChatCompletionsRequestBody(
  config: NormalizedProviderConfig,
  prompt: string,
): ChatCompletionsRequestBody {
  return {
    model: config.model,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  };
}

export function extractAssistantText(response: {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}) {
  return response.choices?.[0]?.message?.content ?? "";
}

export async function requestProviderText(
  config: ProviderConfigInput,
  prompt: string,
) {
  const normalized = normalizeProviderConfig(config);
  const response = await fetch(`${normalized.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${normalized.apiKey}`,
    },
    body: JSON.stringify(buildChatCompletionsRequestBody(normalized, prompt)),
  });

  if (!response.ok) {
    throw new Error(`Provider request failed with status ${response.status}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  return extractAssistantText(json);
}
