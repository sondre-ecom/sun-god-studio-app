import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type JobState = "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "canceled";

export interface HfAuth {
  clientInfo?: unknown;
  tokens?: unknown;
  codeVerifier?: string;
}

export interface User {
  id: string;
  username: string;
  passHash: string; // scrypt: salt:hash (hex)
  role: "admin" | "member";
  anthropicKey?: string; // BYOK: this user's own Anthropic API key (members must set; admin optional)
  hf?: HfAuth; // BYOK: this user's own Higgsfield OAuth connection
  createdAt: number;
}

export interface Brand {
  id: string;
  name: string;
  context: string; // positioning, avatar, product info — fed to the brain
  voc?: string; // real voice-of-customer quotes (organize by avatar/SA) — the brain writes in these words
  productImage?: string; // filename in MEDIA_DIR/products — the REAL product photo, used as an image reference
  productMediaId?: string; // cached Higgsfield media id for the product image
  productMediaOwner?: string; // which user's HF account that media id belongs to
  ownerId?: string;
  createdAt: number;
}

export interface StylePreset {
  id: string;
  name: string;
  block: string; // prepended verbatim to every image prompt
  builtin?: boolean;
}

export interface Character {
  id: string;
  name: string;
  brandId?: string;
  ownerId?: string;
  sheet: string; // verbal description, appended to prompts
  refUrl?: string; // remote image URL
  refMediaId?: string; // higgsfield media id after import
  localPath?: string;
  createdAt: number;
}

export interface Variant {
  id: string;
  jobId: string;
  url?: string;
  localPath?: string;
  mediaId?: string; // higgsfield media id (imported on demand for reference use)
}

export interface Scene {
  id: string;
  n: number;
  copy: string; // VO / on-screen line
  visual: string; // image prompt body (style block prepended at gen time)
  motion: string; // what moves within this scene
  transitionToNext: string; // how it morphs into the next scene
  duration: number; // seconds for the clip starting at this scene
  pendingJobs: string[];
  pendingStartedAt?: number; // when the current still jobs were kicked off (stuck-job timeout)
  variants: Variant[];
  chosenVariantId?: string;
}

export interface Clip {
  id: string;
  fromSceneId: string;
  toSceneId: string | null; // null = outro hold; loop clip points back at scene 1
  isLoop?: boolean;
  prompt?: string;
  pendingJob?: string;
  startedAt?: number; // when the pending job was kicked off (for stuck-job timeout)
  status?: JobState;
  error?: string;
  url?: string;
  localPath?: string;
}

export interface Project {
  id: string;
  title: string;
  ownerId?: string;
  brandId?: string;
  styleId: string;
  imageModel: "nano_banana_pro" | "gpt_image_2";
  videoModel: string; // kling3_0
  resolution: "1k" | "2k" | "4k";
  aspect: string; // 9:16
  mode: "std" | "pro" | "4k";
  sound: "on" | "off";
  infinityLoop: boolean;
  vision: string;
  script: string;
  styleBlock: string;
  characterSheet: string;
  characterIds: string[];
  scenes: Scene[];
  clips: Clip[];
  finalPath?: string;
  status: "storyboard" | "stills" | "clips" | "done";
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MediaItem {
  id: string;
  kind: "image" | "video";
  projectId?: string;
  ownerId?: string;
  label: string;
  jobId?: string;
  url?: string;
  localPath: string;
  favorite: boolean;
  createdAt: number;
}

export interface Settings {
  hf: {
    serverUrl: string;
    clientInfo?: unknown;
    tokens?: unknown;
    codeVerifier?: string;
  };
  workspacePath: string;
}

export interface DB {
  users: User[];
  brands: Brand[];
  styles: StylePreset[];
  characters: Character[];
  projects: Project[];
  library: MediaItem[];
  settings: Settings;
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
export const MEDIA_DIR = path.join(DATA_DIR, "media");
export const PRODUCTS_DIR = path.join(MEDIA_DIR, "products"); // product reference photos (publicly served so Higgsfield can import them)

export const BUILTIN_STYLES: Omit<StylePreset, "id">[] = [
  { name: "Pixar 3D", builtin: true, block: "High-end 3D animated film still, Pixar/DreamWorks quality, expressive stylized characters with large eyes, soft subsurface-scattered skin, cinematic volumetric lighting, shallow depth of field, vibrant warm color grade, 9:16 vertical composition." },
  { name: "Claymation", builtin: true, block: "Stop-motion claymation still, Aardman style, visible fingerprints in plasticine, handcrafted miniature set, soft studio key light, charming tactile imperfections, 9:16 vertical composition." },
  { name: "2D Cartoon", builtin: true, block: "Bold 2D animated still, thick clean outlines, flat saturated colors, exaggerated squash-and-stretch poses, Saturday-morning cartoon energy, 9:16 vertical composition." },
  { name: "Anime", builtin: true, block: "Hand-painted anime film still, Studio-Ghibli-inspired, painterly backgrounds, soft natural light, gentle film grain, emotive characters, 9:16 vertical composition." },
  { name: "Felt Stop-Motion", builtin: true, block: "Stop-motion felt and wool puppet still, needle-felted textures, miniature handmade props, cozy macro lighting, 9:16 vertical composition." },
  { name: "Paper Cutout", builtin: true, block: "Layered paper-craft diorama still, visible cut edges and paper grain, depth from stacked layers, soft top-down light, 9:16 vertical composition." },
  { name: "LEGO", builtin: true, block: "LEGO brick-built minifigure scene, glossy plastic, studs visible, toy-photography macro lighting, 9:16 vertical composition." },
];

let cache: DB | null = null;

function fresh(): DB {
  return {
    users: [],
    brands: [],
    styles: BUILTIN_STYLES.map((s) => ({ ...s, id: uid() })),
    characters: [],
    projects: [],
    library: [],
    settings: {
      hf: { serverUrl: "https://mcp.higgsfield.ai/mcp" },
      workspacePath: process.env.WORKSPACE_PATH || "",
    },
  };
}

export function db(): DB {
  if (cache) return cache;
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  if (fs.existsSync(DB_PATH)) {
    cache = JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as DB;
    if (!cache.users) cache.users = []; // forward-compat for older db files
  } else {
    cache = fresh();
    persist();
  }
  return cache!;
}

function persist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, DB_PATH);
}

export function save() {
  if (cache) persist();
}

export function uid(): string {
  return crypto.randomUUID();
}

export function getProject(id: string): Project | undefined {
  return db().projects.find((p) => p.id === id);
}

export function userById(id: string): User | undefined {
  return db().users.find((u) => u.id === id);
}

export function touch(p: Project) {
  p.updatedAt = Date.now();
  save();
}
