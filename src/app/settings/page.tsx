"use client";

import { useEffect, useState } from "react";
import { jget, jpost, jput, jdel } from "@/lib/api";

interface Brand { id: string; name: string; context: string }

export default function SettingsPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [name, setName] = useState("");
  const [context, setContext] = useState("");

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
    await jpost("/api/brands", { name, context });
    setName(""); setContext("");
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
        <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
          A brand&apos;s context (positioning, avatar, product, what to say / avoid) is fed to the brain when it writes
          storyboards, so every ad stays on-message. Workspace <code>positioning.md</code> is auto-included when present.
        </p>

        <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
          <input className="input" placeholder="Brand name (e.g. Elvora / Low Tide)" value={name} onChange={(e) => setName(e.target.value)} />
          <textarea className="input" rows={3} placeholder="Positioning, avatar, product, tone, claims…" value={context} onChange={(e) => setContext(e.target.value)} style={{ resize: "vertical" }} />
          <div><button className="btn btn-accent" onClick={addBrand} disabled={!name.trim()}>Add brand</button></div>
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
  const dirty = name !== brand.name || context !== brand.context;
  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 12, display: "grid", gap: 8 }}>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      <textarea className="input" rows={3} value={context} onChange={(e) => setContext(e.target.value)} style={{ resize: "vertical" }} />
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-accent btn-sm" disabled={!dirty} onClick={() => onSave({ ...brand, name, context })}>Save</button>
        <button className="btn btn-ghost btn-sm btn-danger" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}
