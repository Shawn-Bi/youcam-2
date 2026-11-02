"use client";

import { useEffect } from "react";
import { warmBackend } from "@/lib/api";

export function BackendWarmup() {
  useEffect(() => { void warmBackend(); }, []);
  return null;
}
