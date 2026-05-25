import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = ({ locals, url }) => {
  if (locals.user && url.pathname !== "/error") {
    throw redirect(303, "/");
  }

  return {
    session: locals.session,
    user: locals.user
  };
};
