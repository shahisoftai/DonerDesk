"use client";

import { useEffect, useState } from "react";
import { checkProjectCodeAction } from "@/lib/actions/projects";

/** How long to wait after the last keystroke before asking the server. */
const QUIET_MS = 500;

/**
 * Whether the typed project code is already used in the workspace, so the wizard can say so before the project is started instead of
 * failing at launch. It asks only while the project has not been created (once it exists, the code is its own) and says "not taken"
 * whenever it cannot tell: the launch still refuses a taken code with a plain sentence.
 */
export function useProjectCodeCheck(code: string | null | undefined, enabled: boolean): boolean {
  const [taken, setTaken] = useState(false);
  useEffect(() => {
    const wanted = (code ?? "").trim();
    if (!enabled || wanted === "") { setTaken(false); return; }
    let current = true;
    const timer = setTimeout(() => { void checkProjectCodeAction(wanted).then((available) => { if (current) setTaken(!available); }).catch(() => { if (current) setTaken(false); }); }, QUIET_MS);
    return () => { current = false; clearTimeout(timer); };
  }, [code, enabled]);
  return taken;
}
