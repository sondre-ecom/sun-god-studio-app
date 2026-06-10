"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { jget, jpost, jdel } from "@/lib/api";

interface Me { id: string; username: string; role: "admin" | "member" }

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/infinity-loop", label: "Infinity Loop" },
  { href: "/library", label: "Library" },
  { href: "/characters", label: "Characters" },
  { href: "/styles", label: "Styles" },
  { href: "/settings", label: "Settings" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);

  const isLogin = path === "/login";

  useEffect(() => {
    if (isLogin) return;
    jget<{ user: Me }>("/api/auth/me").then((r) => setMe(r.user)).catch(() => setMe(null));
    checkConn();
  }, [isLogin, path]);

  async function checkConn() {
    try {
      const r = await jget<{ connected: boolean }>("/api/higgsfield/status");
      setConnected(r.connected);
    } catch {
      setConnected(false);
    }
  }

  async function connect() {
    setConnecting(true);
    try {
      const r = await jpost<{ connected: boolean; authUrl?: string }>("/api/higgsfield/connect");
      if (r.authUrl) {
        window.open(r.authUrl, "_blank", "width=520,height=720");
        const poll = setInterval(async () => {
          const s = await jget<{ connected: boolean }>("/api/higgsfield/status");
          if (s.connected) {
            clearInterval(poll);
            setConnected(true);
            setConnecting(false);
          }
        }, 2000);
        setTimeout(() => {
          clearInterval(poll);
          setConnecting(false);
        }, 120000);
      } else {
        setConnected(r.connected);
        setConnecting(false);
      }
    } catch {
      setConnecting(false);
    }
  }

  async function disconnectHF() {
    await jdel("/api/higgsfield/status");
    setConnected(false);
  }

  async function signOut() {
    await jpost("/api/auth/logout");
    router.push("/login");
    router.refresh();
  }

  if (isLogin) return <>{children}</>;

  const nav = me?.role === "admin" ? [...NAV, { href: "/admin", label: "Admin" }] : NAV;
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 220, flexShrink: 0, borderRight: "1px solid var(--border)", background: "var(--bg-2)",
          display: "flex", flexDirection: "column", padding: "22px 16px", position: "sticky", top: 0, height: "100vh",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.4, marginBottom: 26, paddingLeft: 6 }}>
          Sun God <span style={{ color: "var(--accent)" }}>☀</span> Studio
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              style={{
                padding: "9px 12px", borderRadius: 9, fontSize: 14,
                fontWeight: active(n.href) ? 700 : 500,
                color: active(n.href) ? "var(--text)" : "var(--muted)",
                background: active(n.href) ? "var(--panel-2)" : "transparent", textDecoration: "none",
              }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div style={{ marginTop: "auto", fontSize: 12 }}>
          <div className="muted" style={{ marginBottom: 8 }}>Higgsfield renderer</div>
          {connected === null ? (
            <span className="chip">checking…</span>
          ) : connected ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="chip chip-ok">● connected</span>
              <button className="btn btn-ghost btn-sm" onClick={disconnectHF}>disconnect</button>
            </div>
          ) : (
            <button className="btn btn-accent btn-sm" onClick={connect} disabled={connecting}>
              {connecting ? "waiting for sign-in…" : "Connect Higgsfield"}
            </button>
          )}

          {me && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{me.username}</div>
                <div className="muted" style={{ fontSize: 11 }}>{me.role}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
            </div>
          )}
        </div>
      </aside>
      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  );
}
