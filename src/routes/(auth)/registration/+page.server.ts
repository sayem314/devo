import { auth } from "$lib/server/auth";
import { hasRegisteredUsers } from "$lib/server/auth/users";
import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

const REGISTRATION_CLOSED = "Registration is closed for this Devo instance.";

export const load: PageServerLoad = async () => {
  if (await hasRegisteredUsers()) {
    throw redirect(303, "/login");
  }
};

export const actions: Actions = {
  signUp: async ({ request }) => {
    if (await hasRegisteredUsers()) {
      return fail(403, { error: REGISTRATION_CLOSED });
    }

    const form = await request.formData();
    const nameValue = form.get("name");
    const emailValue = form.get("email");
    const passwordValue = form.get("password");
    const name = typeof nameValue === "string" ? nameValue.trim() : "";
    const email = typeof emailValue === "string" ? emailValue.trim() : "";
    const password = typeof passwordValue === "string" ? passwordValue.trim() : "";

    if (!name || !email || !password) {
      return fail(400, { name, email, error: "Name, email, and password are required." });
    }

    try {
      await auth.api.signUpEmail({
        body: {
          name,
          email,
          password
        },
        headers: request.headers
      });
    } catch (signUpError) {
      return fail(400, {
        name,
        email,
        error:
          signUpError && typeof signUpError === "object" && "message" in signUpError
            ? String(signUpError.message)
            : "Could not create account."
      });
    }

    throw redirect(303, "/");
  }
};
