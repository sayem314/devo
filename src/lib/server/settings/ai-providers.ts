import type { AiProvider } from "../types";

export type AiProviderConfig = {
  id: AiProvider;
  label: string;
  default_model: string;
  default_base_url: string;
};

export const AI_PROVIDERS: AiProviderConfig[] = [
  {
    id: "openai",
    label: "OpenAI",
    default_model: "gpt-5.2",
    default_base_url: "https://api.openai.com/v1"
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    default_model: "claude-sonnet-4-6",
    default_base_url: "https://api.anthropic.com/v1"
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    default_model: "deepseek-v4-flash",
    default_base_url: "https://api.deepseek.com"
  },
  {
    id: "kimi",
    label: "Kimi",
    default_model: "kimi-k2.5",
    default_base_url: "https://api.moonshot.ai/v1"
  },
  {
    id: "glm",
    label: "GLM / Z.ai",
    default_model: "glm-4.6",
    default_base_url: "https://api.z.ai/api/paas/v4"
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    default_model: "openrouter/auto",
    default_base_url: "https://openrouter.ai/api/v1"
  },
  {
    id: "openai-compatible",
    label: "Custom OpenAI-compatible",
    default_model: "",
    default_base_url: ""
  }
];

export function providerConfig(provider: AiProvider) {
  return AI_PROVIDERS.find((item) => item.id === provider) || AI_PROVIDERS[0];
}

export function aiProviderValue(value: unknown): AiProvider {
  if (AI_PROVIDERS.some((provider) => provider.id === value)) return value as AiProvider;
  return "openai";
}
