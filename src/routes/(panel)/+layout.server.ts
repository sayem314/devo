import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = ({ locals }) => {
  if (!locals.user) {
    throw redirect(303, "/login");
  }

  return {
    session: locals.session,
    user: locals.user
  };
};
