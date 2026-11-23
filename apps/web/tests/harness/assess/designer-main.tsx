import { createRoot } from "react-dom/client";
import { FormDesigner } from "@/features/collection/presentation/FormDesigner";

const w = window as unknown as { __h: { calls: Array<[string, unknown[]]> }; __call: (name: string, args: unknown[]) => Promise<unknown> };
w.__h = { calls: [] };
w.__call = (name, args) => { w.__h.calls.push([name, args]); return Promise.resolve({ ok: true, value: { id: "form-new-1" } }); };

createRoot(document.getElementById("root")!).render(
  <div data-testid="host" className="mx-auto max-w-4xl p-4"><FormDesigner projectId="p1" indicators={[{ id: "i1", label: "HFA-1 Facilities assessed" }]} /></div>,
);
