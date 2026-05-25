import { error, fail } from "@sveltejs/kit";
import { createUser, deleteUser, listUsers } from "$lib/server/auth/users";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user?.role !== "admin") throw error(403, "Admin access required");

  return {
    users: await listUsers(),
    current_user_id: locals.user!.id
  };
};

export const actions: Actions = {
  create: async ({ locals, request }) => {
    if (locals.user?.role !== "admin") throw error(403, "Admin access required");

    const form = await request.formData();
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "").trim();
    const role = String(form.get("role") || "user");

    try {
      await createUser({ name, email, password, role });
    } catch (createError) {
      return fail(400, {
        message: createError instanceof Error ? createError.message : "Could not create user.",
        name,
        email,
        role,
        users: await listUsers()
      });
    }

    return {
      saved: true,
      message: "User created.",
      users: await listUsers()
    };
  },
  delete: async ({ locals, request }) => {
    if (locals.user?.role !== "admin") throw error(403, "Admin access required");

    const form = await request.formData();
    const user_id = String(form.get("user_id") || "");

    try {
      await deleteUser(user_id, locals.user!.id);
    } catch (deleteError) {
      return fail(400, {
        message: deleteError instanceof Error ? deleteError.message : "Could not delete user.",
        users: await listUsers()
      });
    }

    return {
      saved: true,
      message: "User deleted.",
      users: await listUsers()
    };
  }
};
