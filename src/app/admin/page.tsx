"use client";

import { useEffect, useState } from "react";
import { jget, jpost, jpatch, jdel } from "@/lib/api";

interface U { id: string; username: string; role: "admin" | "member"; createdAt: number }

export default function AdminPage() {
  const [users, setUsers] = useState<U[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [err, setErr] = useState("");
  const [forbidden, setForbidden] = useState(false);

  async function load() {
    try {
      const r = await jget<{ users: U[] }>("/api/auth/users");
      setUsers(r.users);
    } catch (e) {
      if ((e as Error).message.includes("forbidden")) setForbidden(true);
    }
  }
  useEffect(() => { load(); }, []);

  async function add() {
    setErr("");
    try {
      await jpost("/api/auth/users", { username, password, role });
      setUsername(""); setPassword(""); setRole("member");
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  async function resetPw(id: string) {
    const pw = prompt("New password (≥ 6 chars):");
    if (!pw) return;
    try {
      await jpatch("/api/auth/users", { id, password: pw });
      alert("Password updated.");
    } catch (e) {
      alert((e as Error).message);
    }
  }
  async function remove(id: string) {
    if (!confirm("Delete this user? Their projects stay but they lose access.")) return;
    await jdel(`/api/auth/users?id=${id}`);
    load();
  }

  if (forbidden) return <div style={{ padding: 30 }}>Admins only.</div>;

  return (
    <div style={{ padding: "26px 30px", maxWidth: 820 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px" }}>Admin — users</h1>
      <p className="muted" style={{ fontSize: 14, margin: "0 0 18px" }}>
        Each person gets their own login. Members only see their own ads, characters and brands. Admins see and manage
        everything.
      </p>

      <div className="card" style={{ padding: 16, marginBottom: 22, display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 130px", gap: 10 }}>
          <input className="input" placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input className="input" type="text" placeholder="password (≥6)" value={password} onChange={(e) => setPassword(e.target.value)} />
          <select className="select" value={role} onChange={(e) => setRole(e.target.value as "member" | "admin")}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {err && <div style={{ color: "#ff6b6b", fontSize: 13 }}>{err}</div>}
        <div><button className="btn btn-accent" onClick={add} disabled={!username.trim() || password.length < 6}>Create user</button></div>
      </div>

      <div className="card">
        {users.map((u, i) => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: i ? "1px solid var(--border)" : "none" }}>
            <div style={{ fontWeight: 600 }}>{u.username}</div>
            <span className={u.role === "admin" ? "chip chip-accent" : "chip"}>{u.role}</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => resetPw(u.id)}>Reset password</button>
              <button className="btn btn-ghost btn-sm btn-danger" onClick={() => remove(u.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
