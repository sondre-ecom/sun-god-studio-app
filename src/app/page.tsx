"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { jget, jpost } from "@/lib/api";

interface Brand { id: string; name: string }
interface Style { id: string; name: string }
interface Character { id: string; name: string }
interface ProjectCard {
  id: string; title: string; status: string; infinityLoop: boolean;
  scenes: { variants: { src?: string }[]; chosenVariantId?: string }[];
  finalUrl?: string; updatedAt: number;
}

export default function Dashboard() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [chars, setChars] = useState<Character[]>([]);
  const [projects, setProjects] = useState<ProjectCard[]>([]);

  const [vision, setVision] = useState("");
  const [brandId, setBrandId] = useState("");
  const [styleId, setStyleId] = useState("");
  const [imageModel, setImageModel] = useState<"nano_banana_pro" | "gpt_image_2">("nano_banana_pro");
  const [lengthSec, setLengthSec] = useState(30);
  const [infinityLoop, setInfinityLoop] = useState(false);
  const [pickedChars, setPickedChars] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    const [b, s, c, p] = await Promise.all([
      jget<{ brands: Brand[] }>("/api/brands"),
      jget<{ styles: Style[] }>("/api/styles"),
      jget<{ characters: Character[] }>("/api/characters"),
      jget<{ projects: ProjectCard[] }>("/api/projects"),
    ]);
    setBrands(b.brands);
    setStyles(s.styles);
    setChars(c.characters);
    setProjects(p.projects);
    setStyleId((cur) => cur || (s.styles[0]?.id ?? ""));
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!vision.trim()) return;
    setCreating(true);
    setErr("");
    try {
      const r = await jpost<{ project: { id: string } }>("/api/projects", {
        vision,
        brandId: brandId || undefined,
        styleId,
        imageModel,
        lengthSec,
        infinityLoop,
        characterIds: pickedChars,
      });
      router.push(`/project/${r.project.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setCreating(false);
    }
  }

  async function polish() {
    if (!vision.trim()) return;
    setPolishing(true);
    setErr("");
    try {
      const r = await jpost<{ prompt: string }>("/api/prompt-helper", { idea: vision });
      setVision(r.prompt);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setPolishing(false);
    }
  }

  function thumb(p: ProjectCard): string | undefined {
    const s = p.scenes.find((sc) => sc.chosenVariantId) || p.scenes[0];
    return s?.variants.find((v) => v.src)?.src;
  }

  return (
    <div style={{ padding: "26px 30px", maxWidth: 1100 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 4px" }}>New animated ad</h1>
      <p className="muted" style={{ margin: "0 0 18px", fontSize: 14 }}>
        Describe the idea. The brain writes the storyboard, you approve each keyframe, then Kling 3.0 morphs every scene
        into the next.
      </p>

      <div className="card" style={{ padding: 18 }}>
        <textarea
          className="input"
          rows={3}
          placeholder="Even a few words works — e.g. 'supplement that helps you sleep, for stressed moms'. Then hit ✨ Help me write this."
          value={vision}
          onChange={(e) => setVision(e.target.value)}
          style={{ resize: "vertical", marginBottom: 8 }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <button className="btn btn-sm" onClick={polish} disabled={polishing || !vision.trim()}>
            {polishing ? "Polishing…" : "✨ Help me write this"}
          </button>
          <span className="muted" style={{ fontSize: 12 }}>
            Turns a rough idea into a polished, storyboard-ready prompt you can edit.
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          <Field label="Brand">
            <select className="select" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              <option value="">No brand</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Animation style">
            <select className="select" value={styleId} onChange={(e) => setStyleId(e.target.value)}>
              {styles.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Image model">
            <select className="select" value={imageModel} onChange={(e) => setImageModel(e.target.value as typeof imageModel)}>
              <option value="nano_banana_pro">Nano Banana Pro · 4K</option>
              <option value="gpt_image_2">GPT Image 2 · high</option>
            </select>
          </Field>
          <Field label="Length">
            <select className="select" value={lengthSec} onChange={(e) => setLengthSec(Number(e.target.value))}>
              {[
                { s: 15, l: "15 sec" },
                { s: 30, l: "30 sec" },
                { s: 45, l: "45 sec" },
                { s: 60, l: "1:00 min" },
                { s: 90, l: "1:30 min" },
                { s: 120, l: "2:00 min" },
                { s: 150, l: "2:30 min" },
              ].map((o) => (
                <option key={o.s} value={o.s}>{o.l}</option>
              ))}
            </select>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>≈ {Math.min(26, Math.max(3, Math.round(lengthSec / 6) + 1))} scenes</div>
          </Field>
        </div>

        {chars.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Field label="Characters in this ad">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {chars.map((c) => {
                  const on = pickedChars.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      className={on ? "chip chip-accent" : "chip"}
                      style={{ cursor: "pointer" }}
                      onClick={() => setPickedChars((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                    >
                      {on ? "★ " : ""}{c.name}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, flexWrap: "wrap", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={infinityLoop} onChange={(e) => setInfinityLoop(e.target.checked)} />
            Infinity Loop (last scene morphs back into the first — seamless repeat)
          </label>
          <button className="btn btn-accent" onClick={create} disabled={creating || !vision.trim()}>
            {creating ? "Writing storyboard…" : "Create storyboard →"}
          </button>
        </div>
        {err && <div style={{ color: "#ff6b6b", fontSize: 13, marginTop: 10 }}>{err}</div>}
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "30px 0 12px" }}>Your ads</h2>
      {projects.length === 0 ? (
        <p className="muted" style={{ fontSize: 14 }}>No ads yet. Create your first one above.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 14 }}>
          {projects.map((p) => (
            <a
              key={p.id}
              href={`/project/${p.id}`}
              className="card"
              style={{ overflow: "hidden", textDecoration: "none", color: "inherit" }}
            >
              <div style={{ aspectRatio: "9/16", background: "var(--bg-2)", display: "grid", placeItems: "center", overflow: "hidden" }}>
                {p.finalUrl ? (
                  <video src={p.finalUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                ) : thumb(p) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb(p)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span className="muted" style={{ fontSize: 12 }}>storyboard</span>
                )}
              </div>
              <div style={{ padding: "10px 12px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.title}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <span className={p.status === "done" ? "chip chip-ok" : "chip"}>{p.status}</span>
                  {p.infinityLoop && <span className="chip chip-accent">∞ loop</span>}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>
        {label}
      </div>
      {children}
    </label>
  );
}
