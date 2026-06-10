"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { jget, jpost } from "@/lib/api";
import { useProject, Scene, Clip, Project } from "@/lib/useProject";

export default function InfinityLoopPage() {
  return (
    <Suspense fallback={<div style={{ padding: 30 }} className="pulse">Loading…</div>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const sp = useSearchParams();
  const pid = sp.get("p");
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [selected, setSelected] = useState<string | null>(pid);

  useEffect(() => {
    jget<{ projects: { id: string; title: string }[] }>("/api/projects").then((r) => {
      setProjects(r.projects);
      setSelected((cur) => cur || r.projects[0]?.id || null);
    });
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Infinity Loop</h1>
        <span className="muted" style={{ fontSize: 13 }}>each scene morphs into the next — pick a project to see its transition chain</span>
        <select className="select" style={{ width: 240, marginLeft: "auto" }} value={selected ?? ""} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Select a project…</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>
      {selected ? <Canvas id={selected} /> : (
        <div style={{ flex: 1, display: "grid", placeItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Infinity Loop</div>
            <div className="muted" style={{ marginTop: 6 }}>Pick a project above to open its seamless transition chain.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Canvas({ id }: { id: string }) {
  const { project, refresh, err } = useProject(id);
  const [working, setWorking] = useState<Record<string, boolean>>({});

  if (!project) return <div style={{ padding: 30 }} className={err ? "" : "pulse"}>{err || "Loading…"}</div>;

  async function genTransition(fromId: string, toId: string | null, loop: boolean) {
    const key = `${fromId}->${toId ?? "end"}`;
    setWorking((w) => ({ ...w, [key]: true })); // instant per-clip spinner
    try {
      await jpost(`/api/projects/${id}/clips`, { pairs: [{ from: fromId, to: toId, loop }] });
      await refresh();
    } finally {
      setWorking((w) => ({ ...w, [key]: false }));
    }
  }

  async function genScene(sceneId: string) {
    await jpost(`/api/projects/${id}/scenes/${sceneId}/generate`, { count: 2 });
    refresh();
  }

  // Build the alternating chain: scene, transition, scene, transition, … (+ loop edge)
  const nodes: React.ReactNode[] = [];
  project.scenes.forEach((s, i) => {
    nodes.push(<SceneNode key={"s" + s.id} scene={s} onGen={() => genScene(s.id)} />);
    const next = project.scenes[i + 1];
    if (next) {
      const clip = project.clips.find((c) => c.fromSceneId === s.id && c.toSceneId === next.id);
      nodes.push(
        <Edge
          key={"e" + s.id}
          label={`SCENE ${s.n} → ${next.n}`}
          clip={clip}
          ready={!!s.chosenVariantId && !!next.chosenVariantId}
          working={!!working[`${s.id}->${next.id}`]}
          onGen={() => genTransition(s.id, next.id, false)}
        />
      );
    }
  });
  if (project.infinityLoop && project.scenes.length > 1) {
    const last = project.scenes[project.scenes.length - 1];
    const first = project.scenes[0];
    const clip = project.clips.find((c) => c.isLoop);
    nodes.push(
      <Edge
        key="loop"
        label={`SCENE ${last.n} ↺ ${first.n}`}
        clip={clip}
        ready={!!last.chosenVariantId && !!first.chosenVariantId}
        working={!!working[`${last.id}->${first.id}`]}
        loop
        onGen={() => genTransition(last.id, first.id, true)}
      />
    );
  }

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <Link href={`/project/${id}`} className="btn btn-ghost btn-sm">← Pipeline view</Link>
        {project.infinityLoop && <span className="chip chip-accent">∞ loop enabled — last scene morphs back to scene 1</span>}
      </div>
      <div style={{ display: "flex", alignItems: "stretch", gap: 0, minWidth: "max-content", paddingBottom: 20 }}>
        {nodes}
      </div>
    </div>
  );
}

function SceneNode({ scene, onGen }: { scene: Scene; onGen: () => void }) {
  const chosen = scene.variants.find((v) => v.id === scene.chosenVariantId) || scene.variants[0];
  return (
    <div className="card" style={{ width: 200, flexShrink: 0, overflow: "hidden", alignSelf: "center" }}>
      <div style={{ padding: "8px 10px" }}>
        <div className="muted" style={{ fontSize: 10, letterSpacing: 0.5 }}>SCENE {scene.n}</div>
        <div style={{ fontSize: 12, marginTop: 2, height: 32, overflow: "hidden" }}>{scene.visual}</div>
      </div>
      <div style={{ aspectRatio: "9/16", background: "var(--bg-2)", display: "grid", placeItems: "center", overflow: "hidden" }}>
        {chosen?.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={chosen.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span className="muted" style={{ fontSize: 11 }}>{scene.generating ? "…" : "no still"}</span>
        )}
      </div>
      <div style={{ padding: 8 }}>
        <button className="btn btn-sm" style={{ width: "100%" }} onClick={onGen} disabled={scene.generating}>
          {scene.generating ? "…" : chosen ? "Regenerate" : "Generate still"}
        </button>
      </div>
    </div>
  );
}

function Edge({ label, clip, ready, working, onGen, loop }: {
  label: string; clip?: Clip; ready: boolean; working: boolean; onGen: () => void; loop?: boolean;
}) {
  const loading = working || !!clip?.generating; // either just-clicked, or a job is in flight
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, width: 190, alignSelf: "center" }}>
      <div style={{ width: "100%", height: 1, borderTop: `2px dashed ${loop ? "var(--accent)" : "var(--border)"}`, position: "relative", marginBottom: 8 }} />
      <div className="card" style={{ width: 168, overflow: "hidden", borderColor: loop ? "var(--accent)" : "var(--border)" }}>
        <div style={{ padding: "6px 8px", fontSize: 10, letterSpacing: 0.5, color: loop ? "var(--accent-2)" : "var(--muted)" }}>
          {label} · VIDEO
        </div>
        <div style={{ aspectRatio: "9/16", background: "var(--bg-2)", display: "grid", placeItems: "center", overflow: "hidden" }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div className="spin" style={{ width: 26, height: 26, borderRadius: "50%", border: "3px solid var(--border)", borderTopColor: "var(--accent)" }} />
              <span className="muted" style={{ fontSize: 11 }}>{working ? "restarting…" : "rendering…"}</span>
            </div>
          ) : clip?.src ? (
            <video src={clip.src} style={{ width: "100%", height: "100%", objectFit: "cover" }} controls muted loop />
          ) : clip?.error ? (
            <span style={{ fontSize: 11, color: "#ff6b6b", textAlign: "center", padding: "0 8px" }}>{clip.error}</span>
          ) : (
            <span className="muted" style={{ fontSize: 11 }}>ready</span>
          )}
        </div>
        <div style={{ padding: 8 }}>
          <button className="btn btn-accent btn-sm" style={{ width: "100%" }} onClick={onGen} disabled={!ready || working}>
            {working ? "…" : clip?.generating ? "Restart" : clip?.error ? "Retry" : clip?.src ? "Regenerate morph" : ready ? "Generate morph" : "Approve both scenes"}
          </button>
        </div>
      </div>
      <div style={{ width: "100%", height: 1, borderTop: `2px dashed ${loop ? "var(--accent)" : "var(--border)"}`, marginTop: 8 }} />
    </div>
  );
}
