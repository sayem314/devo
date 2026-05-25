import type { Selectable } from "kysely";
import { getDb, type Database } from "../db";
import type { AiProvider } from "../types";
import { AI_PROVIDERS, aiProviderValue, providerConfig } from "./ai-providers";

export type AiSettings = {
  provider: AiProvider;
  model: string;
  base_url: string;
  api_key: string;
};

export type AiProviderSettings = {
  provider: AiProvider;
  default_model: string;
  base_url: string;
  api_key: string;
  models: string[];
  models_updated_at: string;
};

export type AiProviderSettingsView = {
  provider: AiProvider;
  default_model: string;
  base_url: string;
  has_api_key: boolean;
  models: string[];
  models_updated_at: string;
};

type AiSettingRow = Selectable<Database["ai_setting"]>;

const OPENAI_MODEL_FALLBACKS = ["gpt-5.2", "gpt-5.1", "gpt-5", "gpt-4.1"];
const ANTHROPIC_MODEL_FALLBACKS = ["claude-sonnet-4-6", "claude-opus-4-7"];

function sdkModelIds(provider: AiProvider) {
  if (provider === "openai") return OPENAI_MODEL_FALLBACKS;
  if (provider === "anthropic") return ANTHROPIC_MODEL_FALLBACKS;
  const default_model = providerConfig(provider).default_model;
  return default_model ? [default_model] : [];
}

function normalizeModels(provider: AiProvider, models: string[], default_model?: string) {
  const config = providerConfig(provider);
  const fallback = sdkModelIds(provider);
  // Keep the saved default first, then discovered models, then static fallbacks for providers with limited APIs.
  const values = [default_model || "", config.default_model, ...models, ...fallback]
    .map((model) => model.trim())
    .filter(Boolean);
  return [...new Set(values)];
}

function parseModels(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function rowToSettings(provider: AiProvider, row?: AiSettingRow): AiProviderSettings {
  const config = providerConfig(provider);
  const models = normalizeModels(provider, parseModels(row?.models_json), row?.default_model || undefined);
  return {
    provider,
    default_model: row?.default_model || models[0] || config.default_model,
    base_url: row?.base_url || config.default_base_url,
    api_key: row?.api_key || "",
    models,
    models_updated_at: row?.models_updated_at || ""
  };
}

export function publicAiProviderSettings(settings: AiProviderSettings): AiProviderSettingsView {
  return {
    provider: settings.provider,
    default_model: settings.default_model,
    base_url: settings.base_url,
    has_api_key: Boolean(settings.api_key),
    models: settings.models,
    models_updated_at: settings.models_updated_at
  };
}

export async function listAiProviderSettings(owner_id: string): Promise<AiProviderSettings[]> {
  const db = await getDb();
  const rows = await db.selectFrom("ai_setting").selectAll().where("owner_id", "=", owner_id).execute();
  return AI_PROVIDERS.map((provider) =>
    rowToSettings(
      provider.id,
      rows.find((row) => row.provider === provider.id)
    )
  );
}

export async function getAiProviderSettings(owner_id: string, provider: AiProvider): Promise<AiProviderSettings> {
  const db = await getDb();
  const row = await db
    .selectFrom("ai_setting")
    .selectAll()
    .where("owner_id", "=", owner_id)
    .where("provider", "=", provider)
    .executeTakeFirst();
  return rowToSettings(provider, row);
}

export async function getAiSettings(
  owner_id: string,
  selection?: { provider?: unknown; model?: unknown }
): Promise<AiSettings> {
  const provider = aiProviderValue(selection?.provider);
  const settings = await getAiProviderSettings(owner_id, provider);
  const model = typeof selection?.model === "string" && selection.model.trim() ? selection.model.trim() : "";
  return {
    provider,
    model: model || settings.default_model,
    base_url: settings.base_url,
    api_key: settings.api_key
  };
}

export async function updateAiProviderSettings(
  owner_id: string,
  input: {
    provider: AiProvider;
    default_model?: string;
    base_url?: string;
    api_key?: string;
  }
) {
  const current = await getAiProviderSettings(owner_id, input.provider);
  const timestamp = new Date().toISOString();
  const config = providerConfig(input.provider);
  const base_url = input.provider === "openai-compatible" ? input.base_url?.trim() || "" : config.default_base_url;
  const api_key = input.api_key?.trim() || current.api_key;
  const default_model = input.default_model?.trim() || current.default_model || config.default_model;
  const models = normalizeModels(input.provider, current.models, default_model);

  const db = await getDb();
  await db
    .insertInto("ai_setting")
    .values({
      owner_id: owner_id,
      provider: input.provider,
      default_model: default_model,
      base_url: base_url || null,
      api_key: api_key || null,
      models_json: JSON.stringify(models),
      models_updated_at: current.models_updated_at || null,
      created_at: timestamp,
      updated_at: timestamp
    })
    .onConflict((oc) =>
      oc.columns(["owner_id", "provider"]).doUpdateSet({
        default_model: default_model,
        base_url: base_url || null,
        api_key: api_key || null,
        models_json: JSON.stringify(models),
        updated_at: timestamp
      })
    )
    .execute();

  return getAiProviderSettings(owner_id, input.provider);
}

export async function deleteAiProviderSettings(owner_id: string, provider: AiProvider) {
  const db = await getDb();
  await db.deleteFrom("ai_setting").where("owner_id", "=", owner_id).where("provider", "=", provider).execute();
}

async function fetchOpenAiCompatibleModels(base_url: string, api_key: string) {
  const response = await fetch(`${base_url.replace(/\/+$/, "")}/models`, {
    headers: { authorization: `Bearer ${api_key}` }
  });
  if (!response.ok) throw new Error(`Model refresh failed with ${response.status}`);
  const body = (await response.json()) as { data?: Array<{ id?: unknown }> };
  return (body.data || []).map((item) => item.id).filter((id): id is string => typeof id === "string");
}

export async function refreshAiProviderModels(owner_id: string, provider: AiProvider) {
  const current = await getAiProviderSettings(owner_id, provider);
  if (!current.api_key) throw new Error("API key is required before models can be refreshed.");
  if (provider === "openai-compatible" && !current.base_url) {
    throw new Error("Base URL is required before models can be refreshed.");
  }

  const discovered = await fetchOpenAiCompatibleModels(current.base_url, current.api_key);
  const models = normalizeModels(provider, discovered, current.default_model);
  const default_model = models.includes(current.default_model) ? current.default_model : models[0] || "";
  const timestamp = new Date().toISOString();
  const db = await getDb();

  await db
    .updateTable("ai_setting")
    .set({
      default_model: default_model,
      models_json: JSON.stringify(models),
      models_updated_at: timestamp,
      updated_at: timestamp
    })
    .where("owner_id", "=", owner_id)
    .where("provider", "=", provider)
    .execute();

  return getAiProviderSettings(owner_id, provider);
}
