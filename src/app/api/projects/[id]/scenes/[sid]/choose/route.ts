import { NextRequest, NextResponse } from "next/server";
import { getProject, touch } from "@/lib/store";
import { serializeProject } from "@/lib/serialize";
import { userForProject } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const { id, sid } = await params;
  const p = getProject(id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await userForProject(p, req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const scene = p.scenes.find((s) => s.id === sid);
  if (!scene) return NextResponse.json({ error: "scene not found" }, { status: 404 });
  const { variantId } = await req.json();
  if (!scene.variants.some((v) => v.id === variantId)) return NextResponse.json({ error: "variant not found" }, { status: 404 });
  scene.chosenVariantId = variantId;
  touch(p);
  return NextResponse.json({ project: serializeProject(p) });
}
