/**
 * Higgsfield renderer connection — a real MCP client against mcp.higgsfield.ai.
 * OAuth (sign in with your Higgsfield account), tokens persisted in the local DB.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { db, save } from "./store";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const REDIRECT = `${APP_URL}/api/higgsfield/callback`;

let pendingAuthUrl: string | null = null;

/* eslint-disable @typescript-eslint/no-explicit-any */
const provider: any = {
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
    return db().settings.hf.clientInfo;
  },
  saveClientInformation(info: unknown) {
    db().settings.hf.clientInfo = info;
    save();
  },
  tokens() {
    return db().settings.hf.tokens;
  },
  saveTokens(t: unknown) {
    db().settings.hf.tokens = t;
    save();
  },
  redirectToAuthorization(url: URL) {
    pendingAuthUrl = url.toString();
  },
  saveCodeVerifier(v: string) {
    db().settings.hf.codeVerifier = v;
    save();
  },
  codeVerifier() {
    const v = db().settings.hf.codeVerifier;
    if (!v) throw new Error("No code verifier saved");
    return v;
  },
};

type G = typeof globalThis & { __hfClient?: Client; __hfTools?: any[] };
const g = globalThis as G;

function newTransport() {
  return new StreamableHTTPClientTransport(new URL(db().settings.hf.serverUrl), {
    authProvider: provider,
  });
}

async function getClient(): Promise<Client> {
  if (g.__hfClient) return g.__hfClient;
  const c = new Client({ name: "sun-god-studio", version: "1.0.0" });
  await c.connect(newTransport());
  g.__hfClient = c;
  return c;
}

export function resetClient() {
  try {
    g.__hfClient?.close();
  } catch {}
  g.__hfClient = undefined;
  g.__hfTools = undefined;
}

/** Try to connect. Returns null if connected, or the OAuth URL the user must visit. */
export async function startAuth(): Promise<string | null> {
  pendingAuthUrl = null;
  try {
    await getClient();
    return null;
  } catch (e) {
    if (pendingAuthUrl) return pendingAuthUrl;
    throw e;
  }
}

export async function finishAuthCode(code: string): Promise<void> {
  await newTransport().finishAuth(code);
  resetClient();
  await getClient();
}

export async function isConnected(): Promise<boolean> {
  if (!db().settings.hf.tokens) return false;
  try {
    await listToolDefs();
    return true;
  } catch {
    return false;
  }
}

export function disconnect() {
  resetClient();
  db().settings.hf.tokens = undefined;
  db().settings.hf.codeVerifier = undefined;
  save();
}

async function listToolDefs(): Promise<any[]> {
  if (g.__hfTools) return g.__hfTools;
  const c = await getClient();
  const res = await c.listTools();
  g.__hfTools = res.tools as any[];
  return g.__hfTools!;
}

/** Call a tool by short name, adapting to the server's exact tool name and arg shape. */
export async function callTool(shortName: string, args: Record<string, any>): Promise<any[]> {
  const defs = await listToolDefs();
  const def =
    defs.find((t) => t.name === shortName) ||
    defs.find((t) => t.name.endsWith(`__${shortName}`)) ||
    defs.find((t) => t.name.toLowerCase().includes(shortName.toLowerCase()));
  if (!def) throw new Error(`Higgsfield tool not found: ${shortName} (have: ${defs.map((t) => t.name).join(", ")})`);
  const props = def.inputSchema?.properties ?? {};
  const finalArgs = props.params && !("params" in args) ? { params: args } : args;
  const c = await getClient();
  const res: any = await c.callTool({ name: def.name, arguments: finalArgs });
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
  if (res?.isError) throw new Error("Higgsfield error: " + JSON.stringify(parsed).slice(0, 600));
  return parsed;
}

/* ---------- deep extraction helpers ---------- */

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function deepCollect(obj: any, visit: (key: string, value: any) => void, key = "") {
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

export function extractJobIds(parsed: any[]): string[] {
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

export function extractStatus(parsed: any[]): string | null {
  let found: string | null = null;
  const known = ["queued", "in_progress", "processing", "completed", "failed", "nsfw", "canceled", "success", "done"];
  deepCollect(parsed, (k, v) => {
    if (k === "status" && typeof v === "string" && known.includes(v.toLowerCase())) found = v.toLowerCase();
  });
  if (found === "processing") return "in_progress";
  if (found === "success" || found === "done") return "completed";
  return found;
}

export function extractUrls(parsed: any[]): string[] {
  const urls: string[] = [];
  deepCollect(parsed, (k, v) => {
    if (typeof v === "string" && /^https?:\/\//.test(v) && /(url|src|href)/i.test(k)) urls.push(v);
  });
  return [...new Set(urls)].filter((u) => !/oauth|auth|login/i.test(u));
}

export function extractMediaId(parsed: any[]): string | null {
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

/* ---------- high-level operations ---------- */

export async function generateImage(opts: {
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
  const parsed = await callTool("generate_image", args);
  const ids = extractJobIds(parsed);
  if (!ids.length) throw new Error("No job id in generate_image response: " + JSON.stringify(parsed).slice(0, 600));
  return ids;
}

export async function generateVideo(opts: {
  model: string;
  prompt: string;
  aspect: string;
  duration: number;
  mode: string;
  sound: string;
  startRef: string; // media id or job id
  endRef?: string;
}): Promise<string[]> {
  const medias: any[] = [{ role: "start_image", value: opts.startRef }];
  if (opts.endRef) medias.push({ role: "end_image", value: opts.endRef });
  const parsed = await callTool("generate_video", {
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

export async function jobStatus(jobId: string): Promise<{ status: string; urls: string[] }> {
  const parsed = await callTool("job_status", { jobId });
  return { status: extractStatus(parsed) ?? "in_progress", urls: extractUrls(parsed) };
}

export async function importUrl(url: string): Promise<string> {
  const parsed = await callTool("media_import_url", { url });
  const id = extractMediaId(parsed);
  if (!id) throw new Error("No media id from media_import_url: " + JSON.stringify(parsed).slice(0, 400));
  return id;
}
