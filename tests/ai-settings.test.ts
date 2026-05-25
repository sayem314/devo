import { describe, expect, test } from "bun:test";
import { createUser, modules } from "./helpers/server";

describe("task agent", () => {
  test("requires a configured provider API key", async () => {
    try {
      await modules.agent.generateTaskEdit(
        {
          message: "Build a webhook that receives Shopify orders and saves them to Postgres.",
          mode: "create",
          task: {
            id: "new",
            name: "Untitled task",
            description: "Draft",
            trigger: "webhook",
            timezone: "UTC",
            webhook_path: ""
          },
          files: {
            code: "",
            env_text: "",
            package_json_text: "{}"
          }
        },
        {
          provider: "openai",
          model: "gpt-5.2",
          base_url: "https://api.openai.com/v1",
          api_key: ""
        }
      );
      throw new Error("Expected provider key error");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toInclude("API key");
    }
  });
});

describe("provider settings", () => {
  test("stores AI providers per user and never exposes API keys in public settings", async () => {
    const owner_id = await createUser("provider_owner");
    const otherOwnerId = await createUser("provider_other");

    await modules.aiSettings.updateAiProviderSettings(owner_id, {
      provider: "openai",
      default_model: "gpt-5.2",
      api_key: "owner-openai-key"
    });
    await modules.aiSettings.updateAiProviderSettings(otherOwnerId, {
      provider: "openai",
      default_model: "gpt-5-mini",
      api_key: "other-openai-key"
    });

    const ownerSettings = await modules.aiSettings.getAiSettings(owner_id, { provider: "openai" });
    const otherSettings = await modules.aiSettings.getAiSettings(otherOwnerId, { provider: "openai" });
    const publicOwnerSettings = modules.aiSettings.publicAiProviderSettings(
      await modules.aiSettings.getAiProviderSettings(owner_id, "openai")
    );

    expect(ownerSettings.api_key).toBe("owner-openai-key");
    expect(ownerSettings.model).toBe("gpt-5.2");
    expect(otherSettings.api_key).toBe("other-openai-key");
    expect(otherSettings.model).toBe("gpt-5-mini");
    expect(publicOwnerSettings.has_api_key).toBeTrue();
    expect("api_key" in publicOwnerSettings).toBeFalse();

    await modules.aiSettings.deleteAiProviderSettings(otherOwnerId, "openai");

    expect((await modules.aiSettings.getAiProviderSettings(owner_id, "openai")).api_key).toBe("owner-openai-key");
    expect((await modules.aiSettings.getAiProviderSettings(otherOwnerId, "openai")).api_key).toBe("");
  });

  test("keeps custom OpenAI-compatible base URLs scoped to the owning user", async () => {
    const owner_id = await createUser("custom_provider_owner");
    const otherOwnerId = await createUser("custom_provider_other");

    await modules.aiSettings.updateAiProviderSettings(owner_id, {
      provider: "openai-compatible",
      default_model: "local-model",
      base_url: "http://127.0.0.1:11434/v1",
      api_key: "owner-custom-key"
    });

    const ownerSettings = await modules.aiSettings.getAiSettings(owner_id, {
      provider: "openai-compatible",
      model: "local-model"
    });
    const otherSettings = await modules.aiSettings.getAiProviderSettings(otherOwnerId, "openai-compatible");

    expect(ownerSettings.base_url).toBe("http://127.0.0.1:11434/v1");
    expect(ownerSettings.api_key).toBe("owner-custom-key");
    expect(otherSettings.base_url).toBe("");
    expect(otherSettings.api_key).toBe("");
  });
});
