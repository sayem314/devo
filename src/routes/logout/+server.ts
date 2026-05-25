import { auth } from "$lib/server/auth";
import { redirect, type RequestHandler } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ request }) => {
  try {
    await auth.api.signOut({
      headers: request.headers
    });
  } catch {
    // Signing out should be idempotent from the UI.
  }

  throw redirect(303, "/login");
};
