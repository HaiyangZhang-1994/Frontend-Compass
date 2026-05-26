import { describe, expect, it } from "vitest";
import {
  buildChatCompletionsRequestBody,
  extractAssistantText,
  normalizeProviderConfig,
} from "../../src/semantic/provider-client.js";

describe("normalizeProviderConfig", () => {
  it("normalizes an OpenAI-compatible provider config", () => {
    const config = normalizeProviderConfig({
      baseURL: "https://example.com/v1",
      apiKey: "demo-key",
      model: "gpt-like-model",
    });

    expect(config.baseURL).toBe("https://example.com/v1");
    expect(config.apiKey).toBe("demo-key");
    expect(config.model).toBe("gpt-like-model");
  });

  it("trims trailing slash from baseURL", () => {
    const config = normalizeProviderConfig({
      baseURL: "https://example.com/v1/",
      apiKey: "demo-key",
      model: "gpt-like-model",
    });

    expect(config.baseURL).toBe("https://example.com/v1");
  });

  it("builds a chat completions request body", () => {
    const body = buildChatCompletionsRequestBody(
      normalizeProviderConfig({
        baseURL: "https://example.com/v1",
        apiKey: "demo-key",
        model: "gpt-like-model",
        temperature: 0.2,
        maxTokens: 600,
      }),
      "hello world",
    );

    expect(body.model).toBe("gpt-like-model");
    expect(body.temperature).toBe(0.2);
    expect(body.max_tokens).toBe(600);
    expect(body.messages[0]?.content).toBe("hello world");
  });

  it("extracts assistant text from an OpenAI-compatible response", () => {
    const text = extractAssistantText({
      choices: [
        {
          message: {
            content: "demo response",
          },
        },
      ],
    });

    expect(text).toBe("demo response");
  });
});
