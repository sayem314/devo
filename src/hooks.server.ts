import { migrateDatabase } from "$lib/server/db";
import { auth } from "$lib/server/auth";
import { startRunner } from "$lib/server/runtime/runner";
import { startScheduler } from "$lib/server/scheduler";
import { building } from "$app/environment";
import { json, type Handle } from "@sveltejs/kit";
import { svelteKitHandler } from "better-auth/svelte-kit";

let startupPromise: Promise<void> | undefined;

function ensureStartup() {
  // SvelteKit server hooks run per request, so keep startup work behind one shared promise.
  startupPromise ??= (async () => {
    await migrateDatabase();
    await startRunner();
    startScheduler();
  })().catch((error) => {
    startupPromise = undefined;
    throw error;
  });

  return startupPromise;
}

export const handle: Handle = async ({ event, resolve }) => {
  await ensureStartup();

  const session = await auth.api.getSession({
    headers: event.request.headers
  });

  event.locals.session = session?.session ?? null;
  event.locals.user = session?.user ?? null;

  const pathname = event.url.pathname;

  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth") && !event.locals.user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  return svelteKitHandler({ event, resolve, auth, building });
};
