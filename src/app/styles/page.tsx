"use client";

import { useEffect, useState } from "react";
import { jget, jpost, jdel } from "@/lib/api";

interface Style { id: string; name: string; block: string; builtin?: boolean }

export default function StylesPage() {
  const [styles, setStyles] = useState<Style[]>([]);
  const [name, setName] = useState("");
  const [block, setBlock] = useState("");

  async function load() {
    const r = await jget<{ styles: Style[] }>("/api/styles");
    setStyles(r.styles);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!name.trim() || !block.trim()) return;
    await jpost("/api/styles", { name, block });
    setName(""); setBlock("");
    load();
  }
  async function remove(id: string) {
    await jdel(`/api/styles?id=${id}`);
    load();
  }

  return (
    <div style={{ padding: "26px 30px", maxWidth: 980 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px" }}>Animation styles</h1>
      <p className="muted" style={{ fontSize: 14, margin: "0 0 18px" }}>
        A style is a block of text prepended verbatim to every image prompt so the whole ad shares one look. Seven are
        built in; add your own.
      </p>

      <div className="card" style={{ padding: 16, marginBottom: 22, display: "grid", gap: 10 }}>
        <input className="input" placeholder="Style name (e.g. Watercolor storybook)" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea className="input" rows={3} placeholder="Style block: the descriptive text prepended to every prompt." value={block} onChange={(e) => setBlock(e.target.value)} style={{ resize: "vertical" }} />
        <div><button className="btn btn-accent" onClick={add} disabled={!name.trim() || !block.trim()}>Add style</button></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
        {styles.map((s) => (
          <div key={s.id} className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              {s.name}
              {s.builtin && <span className="chip">built-in</span>}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{s.block}</div>
            {!s.builtin && <button className="btn btn-ghost btn-sm btn-danger" style={{ marginTop: 10 }} onClick={() => remove(s.id)}>Delete</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
