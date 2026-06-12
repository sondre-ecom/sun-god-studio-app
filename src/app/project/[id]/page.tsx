"use client";

import { use, useState } from "react";
import Link from "next/link";
import { jpost, jpatch } from "@/lib/api";
import { useProject, Scene } from "@/lib/useProject";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { project, refresh, err, setErr } = useProject(id);
  const [count, setCount] = useState(2);
  const [busyAll, setBusyAll] = useState(false);
  const [notice, setNotice] = useState("");
  const [sbNote, setSbNote] = useState("");
  const [revising, setRevising] = useState(false);

  if (!project) {
    return <div style={{ padding: 30 }} className={err ? "" : "pulse"}>{err ? <span style={{ color: "#ff6b6b" }}>{err}</span> : "Loading…"}</div>;
  }

  const allChosen = project.scenes.length > 0 && project.scenes.every((s) => s.chosenVariantId);
  const transitionCount = project.scenes.length - 1 + (project.infinityLoop ? 1 : 0);
  const allClips = project.clips.length >= transitionCount && transitionCount > 0 && project.clips.every((c) => c.src);

  async function genScene(sceneId: string) {
    setErr("");
    try {
      await jpost(`/api/projects/${id}/scenes/${sceneId}/generate`, { count });
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function genAll() {
    setBusyAll(true);
    setErr("");
    try {
      for (const s of project!.scenes) {
        if (!s.variants.length && !s.generating) await jpost(`/api/projects/${id}/scenes/${s.id}/generate`, { count });
      }
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusyAll(false);
    }
  }

  async function choose(sceneId: string, variantId: string) {
    await jpost(`/api/projects/${id}/scenes/${sceneId}/choose`, { variantId });
    refresh();
  }

  async function feedback(sceneId: string, fb: string) {
    setErr("");
    try {
      await jpost(`/api/projects/${id}/scenes/${sceneId}/feedback`, { feedback: fb, count });
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function genTransitions() {
    setBusyAll(true);
    setErr("");
    setNotice("");
    try {
      const r = await jpost<{ errors?: string[] }>(`/api/projects/${id}/clips`, {});
      if (r.errors?.length) setNotice(r.errors.join(" · "));
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusyAll(false);
    }
  }

  async function assemble() {
    setBusyAll(true);
    setErr("");
    try {
      await jpost(`/api/projects/${id}/assemble`, {});
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusyAll(false);
    }
  }

  async function setSetting(patch: Record<string, unknown>) {
    await jpatch(`/api/projects/${id}`, patch);
    refresh();
  }

  async function editScene(sceneId: string, patch: Record<string, unknown>) {
    await jpatch(`/api/projects/${id}`, { scenes: [{ id: sceneId, ...patch }] });
    refresh();
  }

  async function reviseStoryboard(body: { feedback?: string; auto?: boolean }) {
    const hasStills = project!.scenes.some((s) => s.variants.length || s.generating);
    if (hasStills && !confirm("Rewriting the storyboard will clear the stills you've already generated. Continue?")) return;
    setRevising(true);
    setErr("");
    try {
      await jpost(`/api/projects/${id}/storyboard`, body);
      setSbNote("");
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRevising(false);
    }
  }

  const approvedCount = project.scenes.filter((s) => s.chosenVariantId).length;

  return (
    <div style={{ padding: "22px 28px", maxWidth: 1180 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <Link href="/" className="btn btn-ghost btn-sm">← Dashboard</Link>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{project.title}</h1>
        <span className={project.status === "done" ? "chip chip-ok" : "chip chip-accent"}>{project.status}</span>
        {project.infinityLoop && <span className="chip chip-accent">∞ loop</span>}
        <Link href={`/infinity-loop?p=${id}`} className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }}>
          Open Infinity Loop canvas →
        </Link>
      </div>

      {/* settings bar */}
      <div className="card" style={{ padding: "10px 14px", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", margin: "12px 0 16px", fontSize: 13 }}>
        <Seg label="Kling mode" value={project.mode} options={["std", "pro", "4k"]} onChange={(v) => setSetting({ mode: v })} />
        <Seg label="Sound" value={project.sound} options={["off", "on"]} onChange={(v) => setSetting({ sound: v })} />
        <span className="muted">Stills: {project.imageModel === "gpt_image_2" ? "GPT Image 2" : "Nano Banana Pro"} · {project.resolution} · {project.aspect}</span>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", cursor: "pointer" }}>
          Variants
          <select className="select" style={{ width: 64, padding: "4px 6px" }} value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button className="btn" onClick={genAll} disabled={busyAll}>Generate all stills</button>
      </div>

      {notice && <div className="card" style={{ padding: 10, fontSize: 13, color: "var(--accent-2)", marginBottom: 12 }}>{notice}</div>}
      {err && <div className="card" style={{ padding: 10, fontSize: 13, color: "#ff6b6b", marginBottom: 12 }}>{err}</div>}

      {/* storyboard */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 10px" }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }} className="muted">
          Storyboard · {project.scenes.length} scenes
        </h2>
        <span className={approvedCount === project.scenes.length && approvedCount > 0 ? "chip chip-ok" : "chip"}>
          {approvedCount}/{project.scenes.length} approved
        </span>
      </div>

      {/* The storyboard is already developed + self-critiqued by the brain. These are optional extra iterations. */}
      <div className="card" style={{ padding: "10px 12px", marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span className="muted" style={{ fontSize: 12 }}>This storyboard was already AI-developed &amp; self-sharpened. Optional:</span>
        <input
          className="input"
          style={{ flex: 1, minWidth: 240 }}
          placeholder="Tell it what to change — e.g. 'open mid-workout instead of the mirror', 'punchier hook', 'make scene 4 the mechanism'"
          value={sbNote}
          onChange={(e) => setSbNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && sbNote.trim()) reviseStoryboard({ feedback: sbNote }); }}
        />
        <button className="btn btn-accent" onClick={() => reviseStoryboard({ feedback: sbNote })} disabled={revising || !sbNote.trim()}>
          {revising ? "Working…" : "Revise with note"}
        </button>
        <button className="btn" onClick={() => reviseStoryboard({ auto: true })} disabled={revising} title="Run another ruthless AI critique-and-rewrite pass">
          ✨ Push further
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {project.scenes.map((s) => (
          <SceneRow key={s.id} scene={s} count={count} onGen={() => genScene(s.id)} onChoose={(vid) => choose(s.id, vid)} onFeedback={(fb) => feedback(s.id, fb)} onEdit={(patch) => editScene(s.id, patch)} />
        ))}
      </div>

      {/* transitions / assembly */}
      <div className="card" style={{ padding: 16, marginTop: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Transitions & final cut</div>
          <span className="muted" style={{ fontSize: 13 }}>
            {transitionCount} morph clip{transitionCount === 1 ? "" : "s"} (Kling 3.0 · each starts on one approved scene, ends on the next{project.infinityLoop ? ", last loops back to scene 1" : ""})
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn btn-accent" onClick={genTransitions} disabled={!allChosen || busyAll}>
              {allChosen ? "Generate transitions" : "Approve every scene first"}
            </button>
            <button className="btn" onClick={assemble} disabled={!allClips || busyAll}>Assemble final ad</button>
          </div>
        </div>

        {project.clips.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10, marginTop: 14 }}>
            {project.clips.map((c) => {
              const from = project.scenes.find((x) => x.id === c.fromSceneId);
              const to = project.scenes.find((x) => x.id === c.toSceneId);
              return (
                <div key={c.id} className="card" style={{ overflow: "hidden", background: "var(--bg-2)" }}>
                  <div style={{ aspectRatio: "9/16", display: "grid", placeItems: "center" }}>
                    {c.src ? (
                      <video src={c.src} style={{ width: "100%", height: "100%", objectFit: "cover" }} controls muted loop />
                    ) : (
                      <span className="muted pulse" style={{ fontSize: 12 }}>{c.generating ? "rendering…" : c.status}</span>
                    )}
                  </div>
                  <div style={{ padding: "6px 8px", fontSize: 11 }} className="muted">
                    {c.isLoop ? `Scene ${from?.n} ↺ Scene ${to?.n}` : `Scene ${from?.n} → ${to ? "Scene " + to.n : "end"}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {project.finalUrl && (
          <div style={{ marginTop: 18, display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
            <video src={project.finalUrl} controls loop style={{ width: 240, borderRadius: 12, background: "#000" }} />
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Final ad ready ✓</div>
              <a className="btn btn-accent" href={project.finalUrl} download={`${project.title}.mp4`}>Download MP4</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Seg({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span className="muted">{label}</span>
      <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            style={{
              padding: "4px 10px", fontSize: 12, border: "none", cursor: "pointer",
              background: value === o ? "var(--accent)" : "transparent",
              color: value === o ? "#190a04" : "var(--muted)", fontWeight: value === o ? 700 : 500,
            }}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function SceneRow({ scene, count, onGen, onChoose, onFeedback, onEdit }: {
  scene: Scene; count: number; onGen: () => void; onChoose: (vid: string) => void; onFeedback: (fb: string) => void; onEdit: (patch: Record<string, unknown>) => void;
}) {
  const [fb, setFb] = useState("");
  const [showFb, setShowFb] = useState(false);
  const [editing, setEditing] = useState(false);
  const [copy, setCopy] = useState(scene.copy);
  const [visual, setVisual] = useState(scene.visual);
  const [transitionToNext, setTransition] = useState(scene.transitionToNext);

  function saveEdit() {
    onEdit({ copy, visual, transitionToNext });
    setEditing(false);
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "30px 1.1fr 1.6fr auto", gap: 14, alignItems: "start" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--muted)" }}>{scene.n}</div>
        {editing ? (
          <div style={{ gridColumn: "2 / 4", display: "flex", flexDirection: "column", gap: 8 }}>
            <label className="muted" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Copy / VO</label>
            <textarea className="input" rows={2} value={copy} onChange={(e) => setCopy(e.target.value)} />
            <label className="muted" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Visual</label>
            <textarea className="input" rows={3} value={visual} onChange={(e) => setVisual(e.target.value)} />
            <label className="muted" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Transition into next</label>
            <textarea className="input" rows={2} value={transitionToNext} onChange={(e) => setTransition(e.target.value)} />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-accent btn-sm" onClick={saveEdit}>Save</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setCopy(scene.copy); setVisual(scene.visual); setTransition(scene.transitionToNext); setEditing(false); }}>Cancel</button>
              {scene.variants.length > 0 && <span className="muted" style={{ fontSize: 11, alignSelf: "center" }}>edits apply to the next regenerate</span>}
            </div>
          </div>
        ) : (
          <>
            <div>
              <div className="muted" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Copy / VO</div>
              <div style={{ fontSize: 13 }}>{scene.copy}</div>
              <div className="chip" style={{ marginTop: 8 }}>{scene.duration}s</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Visual</div>
              <div style={{ fontSize: 13 }}>{scene.visual}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>↪ transition: {scene.transitionToNext}</div>
            </div>
          </>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          <button className="btn btn-accent btn-sm" onClick={onGen} disabled={scene.generating}>
            {scene.generating ? "…" : scene.variants.length ? `+${count} more` : `Generate ${count}`}
          </button>
          {!editing && <button className="btn btn-sm" onClick={() => setEditing(true)}>Edit text</button>}
          {scene.variants.length > 0 && (
            <button className="btn btn-sm" onClick={() => setShowFb((v) => !v)}>Give feedback</button>
          )}
        </div>
      </div>

      {scene.generating && !scene.variants.length && (
        <div className="muted pulse" style={{ fontSize: 12, marginTop: 10 }}>generating keyframe…</div>
      )}

      {scene.variants.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {scene.variants.map((v) => {
            const chosen = v.id === scene.chosenVariantId;
            return (
              <button
                key={v.id}
                onClick={() => onChoose(v.id)}
                style={{
                  width: 96, aspectRatio: "9/16", borderRadius: 10, overflow: "hidden", cursor: "pointer", padding: 0,
                  border: chosen ? "2px solid var(--accent)" : "2px solid var(--border)",
                  boxShadow: chosen ? "0 0 0 3px rgba(255,106,61,.2)" : "none", background: "var(--bg-2)",
                }}
                title={chosen ? "Approved keyframe" : "Click to approve this take"}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {v.src && <img src={v.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              </button>
            );
          })}
          {scene.generating && <div style={{ width: 96, aspectRatio: "9/16", borderRadius: 10, border: "2px dashed var(--border)", display: "grid", placeItems: "center" }} className="muted pulse"><span style={{ fontSize: 11 }}>…</span></div>}
        </div>
      )}

      {showFb && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input
            className="input"
            placeholder="What to change? e.g. warmer light, character looks too old, move product left…"
            value={fb}
            onChange={(e) => setFb(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && fb.trim()) { onFeedback(fb); setFb(""); setShowFb(false); } }}
          />
          <button className="btn btn-accent" disabled={!fb.trim()} onClick={() => { onFeedback(fb); setFb(""); setShowFb(false); }}>
            Redo with notes
          </button>
        </div>
      )}
    </div>
  );
}
