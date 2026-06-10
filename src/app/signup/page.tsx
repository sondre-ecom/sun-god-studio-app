"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { jget, jpost } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeRequired, setCodeRequired] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    jget<{ codeRequired: boolean }>("/api/auth/signup").then((r) => setCodeRequired(r.codeRequired)).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await jpost("/api/auth/signup", { username, password, code });
      router.push("/");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)" }}>
      <form onSubmit={submit} className="card" style={{ padding: 28, width: 340 }}>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>
          Sun God <span style={{ color: "var(--accent)" }}>☀</span> Studio
        </div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>Create your account.</div>

        <label className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Username</label>
        <input className="input" style={{ margin: "5px 0 12px" }} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />

        <label className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Password (min 6)</label>
        <input className="input" type="password" style={{ margin: "5px 0 12px" }} value={password} onChange={(e) => setPassword(e.target.value)} />

        {codeRequired && (
          <>
            <label className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Invite code</label>
            <input className="input" style={{ margin: "5px 0 12px" }} value={code} onChange={(e) => setCode(e.target.value)} />
          </>
        )}

        {err && <div style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <button className="btn btn-accent" style={{ width: "100%", justifyContent: "center" }} disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>

        <div className="muted" style={{ fontSize: 13, marginTop: 16, textAlign: "center" }}>
          Already have an account? <Link href="/login" style={{ color: "var(--accent-2)" }}>Sign in</Link>
        </div>
      </form>
    </div>
  );
}
