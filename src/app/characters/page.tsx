"use client";

import { useEffect, useState } from "react";
import { jget, jpost, jdel } from "@/lib/api";

interface Character { id: string; name: string; sheet: string; refUrl?: string; brandId?: string; refMediaId?: string }
interface Brand { id: string; name: string }

export default function CharactersPage() {
  const [chars, setChars] = useState<Character[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [name, setName] = useState("");
  const [sheet, setSheet] = useState("");
  const [refUrl, setRefUrl] = useState("");
  const [brandId, setBrandId] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const [c, b] = await Promise.all([
      jget<{ characters: Character[] }>("/api/characters"),
      jget<{ brands: Brand[] }>("/api/brands"),
    ]);
    setChars(c.characters);
    setBrands(b.brands);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!name.trim() || !sheet.trim()) return;
    setSaving(true);
    try {
      await jpost("/api/characters", { name, sheet, refUrl: refUrl || undefined, brandId: brandId || undefined });
      setName(""); setSheet(""); setRefUrl(""); setBrandId("");
      load();
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    await jdel(`/api/characters?id=${id}`);
    load();
  }

  return (
    <div style={{ padding: "26px 30px", maxWidth: 980 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px" }}>Characters</h1>
      <p className="muted" style={{ fontSize: 14, margin: "0 0 18px" }}>
        Saved characters keep their look consistent across every scene and ad. Add a description (and optionally a
        reference image URL — it gets imported into Higgsfield and used as a visual reference).
      </p>

      <div className="card" style={{ padding: 16, marginBottom: 22, display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input className="input" placeholder="Name (e.g. Mia — tired new mom)" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="select" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">No brand</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <textarea className="input" rows={3} placeholder="Character sheet: appearance, age, hair, build, wardrobe, vibe — used verbatim in every prompt." value={sheet} onChange={(e) => setSheet(e.target.value)} style={{ resize: "vertical" }} />
        <input className="input" placeholder="Reference image URL (optional)" value={refUrl} onChange={(e) => setRefUrl(e.target.value)} />
        <div>
          <button className="btn btn-accent" onClick={add} disabled={saving || !name.trim() || !sheet.trim()}>
            {saving ? "Saving…" : "Save character"}
          </button>
        </div>
      </div>

      {chars.length === 0 ? (
        <p className="muted" style={{ fontSize: 14 }}>No saved characters yet.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
          {chars.map((c) => (
            <div key={c.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", gap: 10 }}>
                {c.refUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.refUrl} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    ★ {c.name}
                    {c.refMediaId && <span className="chip chip-ok">ref linked</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{c.sheet}</div>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm btn-danger" style={{ marginTop: 10 }} onClick={() => remove(c.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
