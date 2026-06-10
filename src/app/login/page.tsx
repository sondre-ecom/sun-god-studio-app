"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { jpost } from "@/lib/api";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Form />
    </Suspense>
  );
}

function Form() {
  const router = useRouter();
  const sp = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await jpost("/api/auth/login", { username, password });
      router.push(sp.get("next") || "/");
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
        <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>Sign in to make animated ads.</div>
        <label className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Username</label>
        <input className="input" style={{ margin: "5px 0 12px" }} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        <label className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Password</label>
        <input className="input" type="password" style={{ margin: "5px 0 16px" }} value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <div style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <button className="btn btn-accent" style={{ width: "100%", justifyContent: "center" }} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
