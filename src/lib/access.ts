import { NextRequest } from "next/server";
import { currentUser } from "./auth";
import { Project, User } from "./store";

/** Returns the user if they may touch this project, else null. Admins can touch anything. */
export async function userForProject(project: Project, req?: NextRequest): Promise<User | null> {
  const u = await currentUser(req);
  if (!u) return null;
  if (u.role === "admin") return u;
  if (!project.ownerId || project.ownerId === u.id) return u;
  return null;
}
