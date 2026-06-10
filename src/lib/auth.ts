import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { db, save, uid, User } from "./store";
import { SESSION_COOKIE, verifyToken } from "./session";

function hash(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const dk = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${dk}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, dk] = stored.split(":");
  if (!salt || !dk) return false;
  const test = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(dk, "hex");
  const b = Buffer.from(test, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Seed an admin from env on first boot if no users exist. */
export function ensureSeed(): void {
  const d = db();
  if (d.users.length) return;
  const u = process.env.ADMIN_USER || "admin";
  const p = process.env.ADMIN_PASS || "changeme";
  d.users.push({ id: uid(), username: u.toLowerCase(), passHash: hash(p), role: "admin", createdAt: Date.now() });
  save();
}

export function findUser(username: string): User | undefined {
  return db().users.find((u) => u.username === username.toLowerCase());
}

export function getUserById(id: string): User | undefined {
  return db().users.find((u) => u.id === id);
}

export function login(username: string, password: string): User | null {
  ensureSeed();
  const u = findUser(username);
  if (!u || !verifyPassword(password, u.passHash)) return null;
  return u;
}

export function createUser(username: string, password: string, role: "admin" | "member" = "member"): User {
  if (findUser(username)) throw new Error("That username already exists.");
  if (!username.trim() || password.length < 6) throw new Error("Username required and password must be ≥ 6 characters.");
  const u: User = { id: uid(), username: username.trim().toLowerCase(), passHash: hash(password), role, createdAt: Date.now() };
  db().users.push(u);
  save();
  return u;
}

export function deleteUser(id: string): void {
  const d = db();
  d.users = d.users.filter((u) => u.id !== id);
  save();
}

export function setPassword(id: string, password: string): void {
  const u = getUserById(id);
  if (!u) throw new Error("User not found");
  if (password.length < 6) throw new Error("Password must be ≥ 6 characters.");
  u.passHash = hash(password);
  save();
}

/** Resolve the current user from the request cookie (route handlers). */
export async function currentUser(req?: NextRequest): Promise<User | null> {
  let token: string | undefined;
  if (req) token = req.cookies.get(SESSION_COOKIE)?.value;
  else token = (await cookies()).get(SESSION_COOKIE)?.value;
  const uidv = await verifyToken(token);
  if (!uidv) return null;
  return getUserById(uidv) ?? null;
}

export function publicUser(u: User) {
  return { id: u.id, username: u.username, role: u.role, createdAt: u.createdAt };
}
