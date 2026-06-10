"use client";

import { useEffect, useState } from "react";
import { jget, jpatch } from "@/lib/api";

interface Item { id: string; kind: "image" | "video"; label: string; src?: string; favorite: boolean }

export default function LibraryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [kind, setKind] = useState<"all" | "image" | "video">("all");
  const [favOnly, setFavOnly] = useState(false);

  async function load() {
    const q = new URLSearchParams();
    if (kind !== "all") q.set("kind", kind);
    if (favOnly) q.set("fav", "1");
    const r = await jget<{ items: Item[] }>(`/api/library?${q}`);
    setItems(r.items);
  }
  useEffect(() => { load(); }, [kind, favOnly]);

  async function toggleFav(it: Item) {
    await jpatch("/api/library", { id: it.id, favorite: !it.favorite });
    load();
  }

  return (
    <div style={{ padding: "26px 30px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 14px" }}>Library</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {(["all", "image", "video"] as const).map((k) => (
          <button key={k} className={kind === k ? "btn btn-accent btn-sm" : "btn btn-sm"} onClick={() => setKind(k)}>
            {k === "all" ? "All" : k === "image" ? "Images" : "Videos"}
          </button>
        ))}
        <button className={favOnly ? "btn btn-accent btn-sm" : "btn btn-sm"} onClick={() => setFavOnly((v) => !v)}>♥ Favorites</button>
      </div>
      {items.length === 0 ? (
        <p className="muted" style={{ fontSize: 14 }}>Nothing here yet. Generated stills, transition clips, and final ads land here automatically.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12 }}>
          {items.map((it) => (
            <div key={it.id} className="card" style={{ overflow: "hidden" }}>
              <div style={{ aspectRatio: "9/16", background: "var(--bg-2)", position: "relative" }}>
                {it.kind === "video" ? (
                  <video src={it.src} style={{ width: "100%", height: "100%", objectFit: "cover" }} controls muted loop />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                <button
                  onClick={() => toggleFav(it)}
                  style={{ position: "absolute", top: 6, right: 6, border: "none", background: "rgba(0,0,0,.5)", borderRadius: 8, padding: "3px 7px", cursor: "pointer", color: it.favorite ? "var(--accent)" : "#fff" }}
                >
                  ♥
                </button>
              </div>
              <div style={{ padding: "7px 9px", fontSize: 11, display: "flex", justifyContent: "space-between", gap: 6 }} className="muted">
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
                <a href={it.src} download style={{ color: "var(--muted)" }}>↓</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
