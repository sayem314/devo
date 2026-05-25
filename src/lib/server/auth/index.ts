import { getRequestEvent } from "$app/server";
import { betterAuth } from "better-auth";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { appEnv } from "../config/env";
import { getDb } from "../db";
import { hasRegisteredUsers } from "./users";

export const auth = betterAuth({
  appName: "Devo",
  baseURL: appEnv.ORIGIN,
  secret: appEnv.AUTH_SECRET,
  database: {
    db: await getDb(),
    type: "sqlite"
  },
  // Better Auth uses camelCase field names internally; these mappings keep our DB schema snake_case.
  user: {
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at"
    },
    additionalFields: {
      role: {
        type: "string",
        required: false,
        input: false,
        defaultValue: "user"
      }
    }
  },
  session: {
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at"
    },
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24
  },
  account: {
    fields: {
      accountId: "account_id",
      providerId: "provider_id",
      userId: "user_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  },
  verification: {
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8
  },
  databaseHooks: {
    user: {
      create: {
        // Self-hosted MVP: first registered user becomes admin, and later signups are blocked.
        before: async (user) => {
          if (await hasRegisteredUsers()) return false;
          return {
            data: {
              ...user,
              role: "admin"
            }
          };
        }
      }
    }
  },
  plugins: [sveltekitCookies(getRequestEvent)]
});

export type AuthSession = typeof auth.$Infer.Session;
