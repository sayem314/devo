import { auth } from "$lib/server/auth";
import { hasRegisteredUsers } from "$lib/server/auth/users";
import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  return {
    registrationOpen: !(await hasRegisteredUsers())
  };
};

export const actions: Actions = {
  signIn: async ({ request }) => {
    const form = await request.formData();
    const emailValue = form.get("email");
    const passwordValue = form.get("password");
    const email = typeof emailValue === "string" ? emailValue.trim() : "";
    const password = typeof passwordValue === "string" ? passwordValue.trim() : "";

    if (!email || !password) {
      return fail(400, { mode: "signIn", email, error: "Email and password are required." });
    }

    try {
      await auth.api.signInEmail({
        body: {
          email,
          password,
          rememberMe: true
        },
        headers: request.headers
      });
    } catch (signInError) {
      return fail(400, {
        mode: "signIn",
        email,
        error:
          signInError && typeof signInError === "object" && "message" in signInError
            ? String(signInError.message)
            : "Could not sign in."
      });
    }

    throw redirect(303, "/");
  }
};
