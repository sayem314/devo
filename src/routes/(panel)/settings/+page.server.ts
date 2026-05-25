import { fail } from "@sveltejs/kit";
import { updateUserName, updateUserPassword } from "$lib/server/auth/users";
import {
  deleteAiProviderSettings,
  listAiProviderSettings,
  publicAiProviderSettings,
  refreshAiProviderModels,
  updateAiProviderSettings
} from "$lib/server/settings/ai";
import { AI_PROVIDERS, aiProviderValue, providerConfig } from "$lib/server/settings/ai-providers";
import type { Actions, PageServerLoad } from "./$types";

async function ai_settings_view(owner_id: string) {
  return (await listAiProviderSettings(owner_id)).map(publicAiProviderSettings);
}

export const load: PageServerLoad = async ({ locals }) => {
  return {
    account: {
      name: locals.user!.name,
      email: locals.user!.email
    },
    ai_providers: AI_PROVIDERS,
    ai_settings: await ai_settings_view(locals.user!.id)
  };
};

export const actions: Actions = {
  updateProfile: async ({ locals, request }) => {
    const form = await request.formData();
    const name = String(form.get("name") || "").trim();
    const current_password = String(form.get("current_password") || "");
    const new_password = String(form.get("new_password") || "");
    const confirm_password = String(form.get("confirm_password") || "");

    if ((current_password || new_password || confirm_password) && new_password !== confirm_password) {
      return fail(400, {
        section: "account",
        message: "New passwords do not match.",
        name,
        ai_settings: await ai_settings_view(locals.user!.id)
      });
    }

    try {
      await updateUserName(locals.user!.id, name);
      if (current_password || new_password || confirm_password) {
        await updateUserPassword(locals.user!.id, { current_password, new_password });
      }
    } catch (error) {
      return fail(400, {
        section: "account",
        message: error instanceof Error ? error.message : "Could not update profile.",
        name,
        ai_settings: await ai_settings_view(locals.user!.id)
      });
    }

    return {
      section: "account",
      saved: true,
      message:
        current_password || new_password || confirm_password ? "Profile and password updated." : "Profile updated.",
      ai_settings: await ai_settings_view(locals.user!.id)
    };
  },
  saveAi: async ({ locals, request }) => {
    const form = await request.formData();
    const provider = aiProviderValue(form.get("provider"));
    const default_model = String(form.get("default_model") || "").trim();
    const base_url = String(form.get("base_url") || "").trim();
    const api_key = String(form.get("api_key") || "").trim();
    const currentSettings = await listAiProviderSettings(locals.user!.id);
    const current = currentSettings.find((item) => item.provider === provider);

    if (!api_key && !current?.api_key) {
      return fail(400, {
        section: "ai",
        message: "API key is required to add a provider.",
        ai_settings: currentSettings.map(publicAiProviderSettings)
      });
    }

    if (provider === "openai-compatible" && !base_url) {
      return fail(400, {
        section: "ai",
        message: "Base URL is required for a custom OpenAI-compatible provider.",
        ai_settings: currentSettings.map(publicAiProviderSettings)
      });
    }

    const settings = await updateAiProviderSettings(locals.user!.id, {
      provider,
      default_model,
      base_url: base_url || providerConfig(provider).default_base_url,
      api_key
    });

    if (settings.api_key) {
      try {
        await refreshAiProviderModels(locals.user!.id, provider);
      } catch (error) {
        return {
          section: "ai",
          saved: true,
          message: error instanceof Error ? `Saved, but model refresh failed: ${error.message}` : "Saved settings.",
          ai_settings: await ai_settings_view(locals.user!.id)
        };
      }
    }

    return {
      section: "ai",
      saved: true,
      message: "AI provider saved.",
      ai_settings: await ai_settings_view(locals.user!.id)
    };
  },
  refreshModels: async ({ locals, request }) => {
    const form = await request.formData();
    const provider = aiProviderValue(form.get("provider"));

    try {
      await refreshAiProviderModels(locals.user!.id, provider);
    } catch (error) {
      return fail(400, {
        section: "ai",
        message: error instanceof Error ? error.message : "Could not refresh models.",
        ai_settings: await ai_settings_view(locals.user!.id)
      });
    }

    return {
      section: "ai",
      saved: true,
      message: "Model list refreshed.",
      ai_settings: await ai_settings_view(locals.user!.id)
    };
  },
  deleteAi: async ({ locals, request }) => {
    const form = await request.formData();
    const provider = aiProviderValue(form.get("provider"));
    await deleteAiProviderSettings(locals.user!.id, provider);

    return {
      section: "ai",
      saved: true,
      message: "AI provider deleted.",
      ai_settings: await ai_settings_view(locals.user!.id)
    };
  }
};
