import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { VisionResult } from "../types";

type Entry = { result: VisionResult | null; offline: boolean };

// Sends EVERY photo to the Photo Assistant (each one once) and remembers the answer per file.
// The suggestion comes from the first photo that looks like a civic problem; photos that don't
// are listed so the citizen can check them. `onResult` runs once per new answer.
export function usePhotoAssistant(files: File[], onResult?: (r: VisionResult) => void) {
  const [answers, setAnswers] = useState<Map<File, Entry>>(() => new Map());
  const asked = useRef(new Set<File>());
  const callback = useRef(onResult);
  useEffect(() => {
    callback.current = onResult;
  });

  useEffect(() => {
    for (const file of files) {
      if (asked.current.has(file)) continue;
      asked.current.add(file);
      const form = new FormData();
      form.append("image", file);
      api<VisionResult>("/vision/classify?vector=true", { method: "POST", body: form })
        .then((result) => {
          setAnswers((m) => new Map(m).set(file, { result, offline: false }));
          callback.current?.(result);
        })
        .catch(() => setAnswers((m) => new Map(m).set(file, { result: null, offline: true })));
    }
  }, [files]);

  const entries = files.map((f) => answers.get(f));
  const results = entries.map((e) => e?.result ?? null);
  const civicIndex = results.findIndex((r) => r && r.verdict !== "not_civic");
  const allChecked = entries.every(Boolean);
  // While photos are still being checked, wait for the first one; once all are in, prefer a civic photo.
  const primaryIndex = civicIndex >= 0 ? civicIndex : allChecked ? 0 : -1;
  const primary = primaryIndex >= 0 ? results[primaryIndex] : null;

  return {
    // Per photo, for the overlay on each thumbnail.
    photo: (i: number) => ({ loading: !entries[i], result: results[i] ?? null }),
    loading: files.length > 0 && primary === null && !entries.some((e) => e?.offline),
    result: primary,
    offline: files.length > 0 && entries.length > 0 && entries.every((e) => e?.offline),
    // 1-based numbers of photos that don't look like a civic problem (only when another photo does).
    notCivicPhotos: civicIndex >= 0 ? results.flatMap((r, i) => (r?.verdict === "not_civic" ? [i + 1] : [])) : [],
  };
}
