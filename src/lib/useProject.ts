"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { jget } from "@/lib/api";

export interface Variant { id: string; src?: string; jobId: string }
export interface Scene {
  id: string; n: number; copy: string; visual: string; motion: string;
  transitionToNext: string; duration: number;
  variants: Variant[]; chosenVariantId?: string; generating: boolean;
}
export interface Clip {
  id: string; fromSceneId: string; toSceneId: string | null; isLoop?: boolean;
  src?: string; status?: string; generating: boolean; prompt?: string; error?: string; startedAt?: number;
}
export interface Project {
  id: string; title: string; status: string; infinityLoop: boolean;
  imageModel: string; videoModel: string; resolution: string; aspect: string;
  mode: string; sound: string; script: string; styleBlock: string; characterSheet: string;
  scenes: Scene[]; clips: Clip[]; finalUrl?: string; vision: string;
}

export function useProject(id: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [err, setErr] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await jget<{ project: Project }>(`/api/projects/${id}`);
      setProject(r.project);
      return r.project;
    } catch (e) {
      setErr((e as Error).message);
      return null;
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-poll while anything is generating.
  useEffect(() => {
    const busy =
      project &&
      (project.scenes.some((s) => s.generating) || project.clips.some((c) => c.generating));
    if (busy) {
      timer.current = setTimeout(refresh, 4000);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [project, refresh]);

  return { project, setProject, refresh, err, setErr };
}
