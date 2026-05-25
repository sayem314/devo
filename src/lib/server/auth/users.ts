import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { getDb } from "../db";
import { paths } from "../tasks/files";

export async function hasRegisteredUsers() {
  const db = await getDb();
  const existing = await db.selectFrom("user").select("id").limit(1).executeTakeFirst();
  return Boolean(existing);
}

export async function listUsers() {
  const db = await getDb();
  const rows = await db
    .selectFrom("user")
    .select(["id", "name", "email", "role", "created_at", "updated_at"])
    .orderBy((eb) => eb.case().when("role", "=", "admin").then(0).else(1).end())
    .orderBy("created_at", "desc")
    .execute();

  return rows;
}

export async function createUser(input: { name: string; email: string; password: string; role?: string }) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();
  const role = input.role ?? "user";

  if (!name) throw new Error("Name is required.");
  if (!email) throw new Error("Email is required.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

  const db = await getDb();
  const existing = await db.selectFrom("user").select("id").where("email", "=", email).executeTakeFirst();
  if (existing) throw new Error("A user with this email already exists.");

  const timestamp = Date.now();
  const user_id = `user_${randomUUID().slice(0, 12)}`;
  const account_id = `account_${randomUUID().slice(0, 12)}`;
  const password_hash = await hashPassword(password);

  await db
    .insertInto("user")
    .values({
      id: user_id,
      name,
      email,
      role,
      email_verified: 1,
      image: null,
      created_at: timestamp,
      updated_at: timestamp
    })
    .execute();

  await db
    .insertInto("account")
    .values({
      id: account_id,
      account_id: user_id,
      provider_id: "credential",
      user_id: user_id,
      access_token: null,
      refresh_token: null,
      id_token: null,
      access_token_expires_at: null,
      refresh_token_expires_at: null,
      scope: null,
      password: password_hash,
      created_at: timestamp,
      updated_at: timestamp
    })
    .execute();

  return { id: user_id, name, email, role, created_at: timestamp, updated_at: timestamp };
}

export async function updateUserName(user_id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required.");

  const db = await getDb();
  await db
    .updateTable("user")
    .set({
      name: trimmed,
      updated_at: Date.now()
    })
    .where("id", "=", user_id)
    .execute();
}

export async function updateUserPassword(user_id: string, input: { current_password: string; new_password: string }) {
  if (!input.current_password) throw new Error("Current password is required.");
  if (input.new_password.length < 8) throw new Error("New password must be at least 8 characters.");
  if (input.current_password === input.new_password)
    throw new Error("New password must be different from the current password.");

  const db = await getDb();
  const account = await db
    .selectFrom("account")
    .select(["id", "password"])
    .where("user_id", "=", user_id)
    .where("provider_id", "=", "credential")
    .executeTakeFirst();

  if (!account?.password) throw new Error("Password login is not configured for this user.");

  const valid = await verifyPassword({ hash: account.password, password: input.current_password });
  if (!valid) throw new Error("Current password is incorrect.");

  await db
    .updateTable("account")
    .set({
      password: await hashPassword(input.new_password),
      updated_at: Date.now()
    })
    .where("id", "=", account.id)
    .execute();
}

export async function deleteUser(user_id: string, current_user_id: string) {
  if (user_id === current_user_id) throw new Error("You cannot delete your own account.");

  const db = await getDb();
  const user = await db.selectFrom("user").select(["id", "email", "role"]).where("id", "=", user_id).executeTakeFirst();
  if (!user) throw new Error("User not found.");

  if (user.role === "admin") {
    const admins = await db.selectFrom("user").select("id").where("role", "=", "admin").execute();
    if (admins.length <= 1) throw new Error("You cannot delete the last admin.");
  }

  const tasks = await db.selectFrom("task").select("id").where("owner_id", "=", user_id).execute();
  const task_ids = tasks.map((task) => task.id);

  await db.transaction().execute(async (trx) => {
    // The user foreign keys cascade sessions, accounts, tasks, runs, run logs, and AI settings.
    // Verification rows are keyed by email identifier, so they need explicit cleanup.
    await trx.deleteFrom("verification").where("identifier", "=", user.email).execute();
    await trx.deleteFrom("user").where("id", "=", user_id).execute();
  });

  await Promise.all(task_ids.map((task_id) => rm(paths.taskDir(task_id), { recursive: true, force: true })));
}
