"use client";

import { useEffect, useState } from "react";
import { jget, jpost, jput, jdel } from "@/lib/api";

interface Brand { id: string; name: string; context: string; voc?: string; productImageUrl?: string }

// Read an image file into a base64 data URL (client-side).
function readImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function ProductImageInput({ url, onPick }: { url?: string; onPick: (dataUrl: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="product" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
      )}
      <label className="btn btn-sm" style={{ cursor: "pointer" }}>
        🧴 {url ? "Replace product photo" : "Upload product photo"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: "none" }}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) onPick(await readImageDataUrl(f));
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

// Read uploaded text files into one labelled string (client-side; nothing leaves the browser until Save).
async function readFilesToText(files: FileList): Promise<string> {
  const parts: string[] = [];
  for (const f of Array.from(files)) {
    const text = await f.text();
    parts.push(`## ${f.name}\n${text.trim()}`);
  }
  return parts.join("\n\n");
}

function UploadButton({ onText, label = "📎 Upload file(s)" }: { onText: (t: string) => void; label?: string }) {
  return (
    <label className="btn btn-sm" style={{ cursor: "pointer" }}>
      {label}
      <input
        type="file"
        multiple
        accept=".txt,.md,.markdown,.csv,.json,text/*"
        style={{ display: "none" }}
        onChange={async (e) => {
          const files = e.target.files;
          if (files?.length) onText(await readFilesToText(files));
          e.target.value = "";
        }}
      />
    </label>
  );
}

export default function SettingsPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [voc, setVoc] = useState("");
  const [productImg, setProductImg] = useState("");

  const [hasKey, setHasKey] = useState(false);
  const [role, setRole] = useState<"admin" | "member">("member");
  const [hasFallback, setHasFallback] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keyErr, setKeyErr] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  async function load() {
    const [s, b, k] = await Promise.all([
      jget<{ connected: boolean }>("/api/higgsfield/status"),
      jget<{ brands: Brand[] }>("/api/brands"),
      jget<{ hasKey: boolean; role: "admin" | "member"; hasFallback: boolean }>("/api/auth/key"),
    ]);
    setConnected(s.connected);
    setBrands(b.brands);
    setHasKey(k.hasKey);
    setRole(k.role);
    setHasFallback(k.hasFallback);
  }
  useEffect(() => { load(); }, []);

  async function saveKey() {
    setSavingKey(true);
    setKeyErr("");
    try {
      await jpost("/api/auth/key", { key: keyInput });
      setKeyInput("");
      load();
    } catch (e) {
      setKeyErr((e as Error).message);
    } finally {
      setSavingKey(false);
    }
  }
  async function clearKey() {
    await jdel("/api/auth/key");
    load();
  }

  async function addBrand() {
    if (!name.trim()) return;
    await jpost("/api/brands", { name, context, voc, productImageDataUrl: productImg || undefined });
    setName(""); setContext(""); setVoc(""); setProductImg("");
    load();
  }
  async function saveBrand(b: Brand) {
    await jput("/api/brands", b);
    load();
  }
  async function removeBrand(id: string) {
    await jdel(`/api/brands?id=${id}`);
    load();
  }

  return (
    <div style={{ padding: "26px 30px", maxWidth: 860 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 18px" }}>Settings</h1>

      {/* Your own Anthropic key (BYOK) */}
      <div className="card" style={{ padding: 16, marginBottom: 22 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Your Anthropic API key (the storyboard brain)</div>
        <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
          {role === "admin"
            ? "As the owner you can leave this blank — the app uses the server key (or your own login). Set a key here only if you want this account billed to a specific key."
            : "Storyboards run on your own Anthropic key — you only pay for your own usage, and it's never shared. Get one at console.anthropic.com → API Keys (and add a few dollars of credit). It starts with sk-ant-…"}
        </p>
        <div style={{ marginBottom: 8 }}>
          {hasKey ? (
            <span className="chip chip-ok">● your key is set</span>
          ) : hasFallback ? (
            <span className="chip">using server / owner login</span>
          ) : (
            <span className="chip" style={{ color: "var(--accent-2)", borderColor: "rgba(255,106,61,.4)" }}>no key yet — add one to generate</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" type="password" placeholder="sk-ant-…" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} />
          <button className="btn btn-accent" disabled={savingKey || !keyInput.trim()} onClick={saveKey}>Save key</button>
          {hasKey && <button className="btn btn-ghost btn-danger" onClick={clearKey}>Remove</button>}
        </div>
        {keyErr && <div style={{ color: "#ff6b6b", fontSize: 13, marginTop: 8 }}>{keyErr}</div>}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 22 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Higgsfield renderer (your account)</div>
        <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
          Stills and Kling 3.0 video render through <b>your own</b> Higgsfield account (sign in via OAuth — no keys to paste),
          so you spend only your own credits. Connect from the sidebar. Status: {connected === null ? "checking…" : connected ? <span style={{ color: "var(--ok)" }}>connected ✓</span> : "not connected"}
        </p>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Brands</div>
        <p className="muted" style={{ fontSize: 13, margin: "0 0 6px" }}>
          A brand&apos;s context + Voice of Customer is fed to the brain when it writes storyboards for <strong>you</strong>, so your ads
          sound like your customers. <strong>Upload or paste your own files</strong> below.
        </p>
        <p style={{ fontSize: 12, margin: "0 0 12px", padding: "8px 10px", borderRadius: 8, background: "rgba(74,222,128,.08)", border: "1px solid rgba(74,222,128,.3)" }}>
          🔒 <strong>Your data stays in your account only.</strong> It is never added to the shared app brain and no other user can see it.
          The brain&apos;s skill comes from general marketing craft — your uploads personalize <em>only your</em> ads.
        </p>

        <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
          <input className="input" placeholder="Brand name (e.g. Low Tide)" value={name} onChange={(e) => setName(e.target.value)} />
          <textarea className="input" rows={3} placeholder="Positioning, avatar, product, tone, claims…" value={context} onChange={(e) => setContext(e.target.value)} style={{ resize: "vertical" }} />
          <textarea className="input" rows={3} placeholder={"Voice of Customer — real customer quotes, grouped by avatar/SA. The brain writes hooks in these exact words. (Or upload files →)"} value={voc} onChange={(e) => setVoc(e.target.value)} style={{ resize: "vertical" }} />
          <label className="muted" style={{ fontSize: 11 }}>Product photo — the real bottle/tub. Scenes that show the product will match this exactly.</label>
          <ProductImageInput url={productImg || undefined} onPick={setProductImg} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <UploadButton label="📎 Upload VOC / brand files" onText={(t) => setVoc((v) => (v ? v + "\n\n" : "") + t)} />
            <button className="btn btn-accent" onClick={addBrand} disabled={!name.trim()}>Add brand</button>
          </div>
        </div>

        {brands.map((b) => (
          <BrandEditor key={b.id} brand={b} onSave={saveBrand} onDelete={() => removeBrand(b.id)} />
        ))}
      </div>
    </div>
  );
}

function BrandEditor({ brand, onSave, onDelete }: { brand: Brand; onSave: (b: Brand) => void; onDelete: () => void }) {
  const [name, setName] = useState(brand.name);
  const [context, setContext] = useState(brand.context);
  const [voc, setVoc] = useState(brand.voc || "");
  const [productImg, setProductImg] = useState("");
  const dirty = name !== brand.name || context !== brand.context || voc !== (brand.voc || "") || !!productImg;
  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 12, display: "grid", gap: 8 }}>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="muted" style={{ fontSize: 11 }}>Positioning / avatar / product</label>
      <textarea className="input" rows={3} value={context} onChange={(e) => setContext(e.target.value)} style={{ resize: "vertical" }} />
      <label className="muted" style={{ fontSize: 11 }}>Voice of Customer — real quotes (group by avatar/SA). The brain writes in these words.</label>
      <textarea className="input" rows={4} value={voc} onChange={(e) => setVoc(e.target.value)} placeholder={"SA1 — Creatine Hostage:\n\"it's mostly waterweight, I don't like the bloated look either\"\n\nSA2 — Betrayed Veteran:\n\"I look more cut in the morning than later in the day\""} style={{ resize: "vertical" }} />
      <label className="muted" style={{ fontSize: 11 }}>Product photo — scenes that show the product match this exactly.</label>
      <ProductImageInput url={productImg || brand.productImageUrl} onPick={setProductImg} />
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-accent btn-sm" disabled={!dirty} onClick={() => onSave({ ...brand, name, context, voc, productImageDataUrl: productImg || undefined } as Brand)}>Save</button>
        <UploadButton label="📎 Add file(s) to VOC" onText={(t) => setVoc((v) => (v ? v + "\n\n" : "") + t)} />
        <button className="btn btn-ghost btn-sm btn-danger" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}
