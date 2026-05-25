import type { AuthSession } from "$lib/server/auth";

declare global {
  namespace App {
    interface Locals {
      session: AuthSession["session"] | null;
      user: AuthSession["user"] | null;
    }

    interface PageData {
      session?: AuthSession["session"] | null;
      user?: AuthSession["user"] | null;
    }
  }
}

export {};
