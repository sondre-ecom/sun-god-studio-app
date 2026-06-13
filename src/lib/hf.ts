/**
 * Higgsfield renderer — BYOK / per-user. Each user connects their OWN Higgsfield
 * account; their OAuth tokens live on their user record, and each user gets their
 * own MCP client. Nobody shares anyone else's Higgsfield connection.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
import { db, save, userById, HfAuth } from "./store";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const REDIRECT = `${APP_URL}/api/higgsfield/callback`;

function serverUrl(): string {
  return db().settings.hf.serverUrl || "https://mcp.higgsfield.ai/mcp";
}

/** Reject after `ms` if the promise hasn't settled — prevents a hung network call from freezing a sweep. */
function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);
}

function hfStore(userId: string): HfAuth {
  const u = userById(userId);
  if (!u) throw new Error("Unknown user");
  if (!u.hf) u.hf = {};
  return u.hf;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function providerFor(userId: string, holder?: { url?: string }): any {
  return {
    get redirectUrl() {
      return REDIRECT;
    },
    get clientMetadata() {
      return {
        redirect_uris: [REDIRECT],
        client_name: "Sun God Studio",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      };
    },
    clientInformation() {
      return hfStore(userId).clientInfo;
    },
    saveClientInformation(info: unknown) {
      hfStore(userId).clientInfo = info;
      save();
    },
    tokens() {
      return hfStore(userId).tokens;
    },
    saveTokens(t: unknown) {
      hfStore(userId).tokens = t;
      save();
    },
    redirectToAuthorization(url: URL) {
      if (holder) holder.url = url.toString();
    },
    saveCodeVerifier(v: string) {
      hfStore(userId).codeVerifier = v;
      save();
    },
    codeVerifier() {
      const v = hfStore(userId).codeVerifier;
      if (!v) throw new Error("No code verifier saved");
      return v;
    },
  };
}

type G = typeof globalThis & { __hfClients?: Map<string, Client>; __hfTools?: Map<string, any[]> };
const g = globalThis as G;
const clients = (g.__hfClients ||= new Map());
const toolsCache = (g.__hfTools ||= new Map());

function transport(userId: string, holder?: { url?: string }) {
  return new StreamableHTTPClientTransport(new URL(serverUrl()), { authProvider: providerFor(userId, holder) });
}

async function connectClient(userId: string, holder?: { url?: string }): Promise<Client> {
  const c = new Client({ name: "sun-god-studio", version: "1.0.0" });
  await c.connect(transport(userId, holder));
  return c;
}

async function getClient(userId: string): Promise<Client> {
  const existing = clients.get(userId);
  if (existing) return existing;
  const c = await connectClient(userId);
  clients.set(userId, c);
  return c;
}

function reset(userId: string) {
  try {
    clients.get(userId)?.close();
  } catch {}
  clients.delete(userId);
  toolsCache.delete(userId);
}

/** Try to connect this user. Returns null if connected, or the OAuth URL they must visit. */
export async function startAuth(userId: string): Promise<string | null> {
  const holder: { url?: string } = {};
  try {
    const c = await connectClient(userId, holder);
    clients.set(userId, c);
    return null;
  } catch (e) {
    if (holder.url) return holder.url;
    throw e;
  }
}

export async function finishAuthCode(userId: string, code: string): Promise<void> {
  await transport(userId).finishAuth(code);
  reset(userId);
  await getClient(userId);
}

export async function isConnected(userId: string): Promise<boolean> {
  if (!hfStore(userId).tokens) return false;
  try {
    await listToolDefs(userId);
    return true;
  } catch {
    return false;
  }
}

export function disconnect(userId: string) {
  reset(userId);
  const s = hfStore(userId);
  s.tokens = undefined;
  s.codeVerifier = undefined;
  save();
}

async function listToolDefs(userId: string): Promise<any[]> {
  const cached = toolsCache.get(userId);
  if (cached) return cached;
  const c = await getClient(userId);
  const res = await c.listTools();
  const defs = res.tools as any[];
  toolsCache.set(userId, defs);
  return defs;
}

const AUTH_ERROR = /invalid or expired token|unauthor|not authenticated|401|token.*expired|expired.*token/i;

export async function callTool(userId: string, shortName: string, args: Record<string, any>, _retried = false): Promise<any[]> {
  const defs = await listToolDefs(userId);
  const def =
    defs.find((t) => t.name === shortName) ||
    defs.find((t) => t.name.endsWith(`__${shortName}`)) ||
    defs.find((t) => t.name.toLowerCase().includes(shortName.toLowerCase()));
  if (!def) throw new Error(`Higgsfield tool not found: ${shortName}`);
  const props = def.inputSchema?.properties ?? {};
  const finalArgs = props.params && !("params" in args) ? { params: args } : args;
  const c = await getClient(userId);
  // Hard timeout so a hung Higgsfield call can never freeze the polling sweep.
  const res: any = await withTimeout(c.callTool({ name: def.name, arguments: finalArgs }), 45000, `Higgsfield ${shortName} timed out`);
  const parsed: any[] = [];
  for (const block of res?.content ?? []) {
    if (block.type === "text") {
      try {
        parsed.push(JSON.parse(block.text));
      } catch {
        parsed.push({ text: block.text });
      }
    } else {
      parsed.push(block);
    }
  }
  if (res?.structuredContent) parsed.push(res.structuredContent);

  // Higgsfield returns an expired-token error inside a 200 (not a 401), so the SDK's normal
  // refresh-on-401 never fires. Detect it and run the OAuth refresh ourselves using the stored
  // refresh token, then retry once — silently, no manual reconnect needed.
  const flat = JSON.stringify(parsed).toLowerCase();
  if (res?.isError || AUTH_ERROR.test(flat)) {
    if (AUTH_ERROR.test(flat) && !_retried) {
      let refreshed = false;
      try {
        refreshed = (await auth(providerFor(userId), { serverUrl: serverUrl() })) === "AUTHORIZED";
      } catch {}
      reset(userId); // drop the cached client so it reconnects with the refreshed token
      if (refreshed) return callTool(userId, shortName, args, true);
    }
    if (AUTH_ERROR.test(flat)) {
      throw new Error("Your Higgsfield sign-in expired and couldn't auto-refresh. Click ‘disconnect’ then ‘Connect Higgsfield’ in the sidebar once — after that it should stay connected.");
    }
    throw new Error("Higgsfield error: " + JSON.stringify(parsed).slice(0, 600));
  }
  return parsed;
}

/* ---------- extraction helpers ---------- */

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function deepCollect(obj: any, visit: (key: string, value: any) => void, key = "") {
  if (obj === null || obj === undefined) return;
  if (Array.isArray(obj)) {
    for (const v of obj) deepCollect(v, visit, key);
    return;
  }
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) deepCollect(v, visit, k);
    return;
  }
  visit(key, obj);
}

function extractJobIds(parsed: any[]): string[] {
  const strong: string[] = [];
  const weak: string[] = [];
  deepCollect(parsed, (k, v) => {
    if (typeof v !== "string" || !UUID.test(v)) return;
    if (/^(job_?ids?|ids?)$/i.test(k) || /job/i.test(k)) strong.push(v);
    else weak.push(v);
  });
  const ids = strong.length ? strong : weak;
  return [...new Set(ids)];
}

function extractStatus(parsed: any[]): string | null {
  let found: string | null = null;
  const known = ["queued", "in_progress", "processing", "completed", "failed", "nsfw", "canceled", "success", "done"];
  deepCollect(parsed, (k, v) => {
    if (k === "status" && typeof v === "string" && known.includes(v.toLowerCase())) found = v.toLowerCase();
  });
  if (found === "processing") return "in_progress";
  if (found === "success" || found === "done") return "completed";
  return found;
}

function extractUrls(parsed: any[]): string[] {
  const urls: string[] = [];
  deepCollect(parsed, (k, v) => {
    if (typeof v === "string" && /^https?:\/\//.test(v) && /(url|src|href)/i.test(k)) urls.push(v);
  });
  return [...new Set(urls)].filter((u) => !/oauth|auth|login/i.test(u));
}

function extractMediaId(parsed: any[]): string | null {
  let found: string | null = null;
  deepCollect(parsed, (k, v) => {
    if (!found && typeof v === "string" && UUID.test(v) && /media/i.test(k)) found = v;
  });
  if (!found) {
    deepCollect(parsed, (k, v) => {
      if (!found && k === "id" && typeof v === "string" && UUID.test(v)) found = v;
    });
  }
  return found;
}

/* ---------- high-level operations (all per-user) ---------- */

export async function generateImage(userId: string, opts: {
  model: string;
  prompt: string;
  aspect: string;
  resolution: string;
  count: number;
  refMediaIds?: string[];
}): Promise<string[]> {
  const args: Record<string, any> = {
    model: opts.model,
    prompt: opts.prompt,
    aspect_ratio: opts.aspect,
    resolution: opts.resolution,
    count: opts.count,
  };
  if (opts.model === "gpt_image_2") args.quality = "high";
  if (opts.refMediaIds?.length) args.medias = opts.refMediaIds.map((v) => ({ role: "image", value: v }));
  const parsed = await callTool(userId, "generate_image", args);
  const ids = extractJobIds(parsed);
  if (!ids.length) throw new Error("No job id in generate_image response: " + JSON.stringify(parsed).slice(0, 600));
  return ids;
}

export async function generateVideo(userId: string, opts: {
  model: string;
  prompt: string;
  aspect: string;
  duration: number;
  mode: string;
  sound: string;
  startRef: string;
  endRef?: string;
}): Promise<string[]> {
  const medias: any[] = [{ role: "start_image", value: opts.startRef }];
  if (opts.endRef) medias.push({ role: "end_image", value: opts.endRef });
  const parsed = await callTool(userId, "generate_video", {
    model: opts.model,
    prompt: opts.prompt,
    aspect_ratio: opts.aspect,
    duration: opts.duration,
    mode: opts.mode,
    sound: opts.sound,
    medias,
  });
  const ids = extractJobIds(parsed);
  if (!ids.length) throw new Error("No job id in generate_video response: " + JSON.stringify(parsed).slice(0, 600));
  return ids;
}

export async function jobStatus(userId: string, jobId: string): Promise<{ status: string; urls: string[] }> {
  const parsed = await callTool(userId, "job_status", { jobId });
  return { status: extractStatus(parsed) ?? "in_progress", urls: extractUrls(parsed) };
}

export async function importUrl(userId: string, url: string): Promise<string> {
  const parsed = await callTool(userId, "media_import_url", { url });
  const id = extractMediaId(parsed);
  if (!id) throw new Error("No media id from media_import_url: " + JSON.stringify(parsed).slice(0, 400));
  return id;
}
