"use client";

import { useEffect, useState } from "react";
import { jget, jpost, jput, jdel } from "@/lib/api";

interface Brand { id: string; name: string; context: string }

export default function SettingsPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [name, setName] = useState("");
  const [context, setContext] = useState("");

  async function load() {
    const [s, b] = await Promise.all([
      jget<{ connected: boolean }>("/api/higgsfield/status"),
      jget<{ brands: Brand[] }>("/api/brands"),
    ]);
    setConnected(s.connected);
    setBrands(b.brands);
  }
  useEffect(() => { load(); }, []);

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

      <div className="card" style={{ padding: 16, marginBottom: 22 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Higgsfield renderer</div>
        <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
          The app generates stills and Kling 3.0 video through your Higgsfield account over MCP (OAuth — no API keys to
          paste). Connect from the sidebar. Status: {connected === null ? "checking…" : connected ? <span style={{ color: "var(--ok)" }}>connected ✓</span> : "not connected"}
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
