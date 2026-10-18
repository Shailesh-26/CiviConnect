import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { VisionResult } from "../types";

type State = { file: File | null; result: VisionResult | null; offline: boolean };

// Sends the first photo to the Photo Assistant and remembers the answer for that exact file.
// `onResult` runs once per new answer (used to pre-select the category).
export function usePhotoAssistant(file: File | null, onResult?: (r: VisionResult) => void) {
  const [state, setState] = useState<State>({ file: null, result: null, offline: false });
  const callback = useRef(onResult);
  useEffect(() => {
    callback.current = onResult;
  });

  useEffect(() => {
    if (!file) return;
    let active = true;
    const form = new FormData();
    form.append("image", file);
    api<VisionResult>("/vision/classify?vector=true", { method: "POST", body: form })
      .then((result) => {
        if (!active) return;
        setState({ file, result, offline: false });
        callback.current?.(result);
      })
      .catch(() => active && setState({ file, result: null, offline: true }));
    return () => {
      active = false;
    };
  }, [file]);

  const current = file !== null && state.file === file;
  return {
    loading: file !== null && !current,
    result: current ? state.result : null,
    offline: current ? state.offline : false,
  };
}
