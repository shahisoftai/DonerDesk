import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Drawer } from "@/components/feedback/Drawer";

/** Two panels, the second opened from inside the first, and a third that has unsaved changes. */
function Page() {
  const [a, setA] = useState(false);
  const [b, setB] = useState(false);
  const [c, setC] = useState(false);
  return (
    <div>
      <button onClick={() => setA(true)}>Open A</button>
      <button onClick={() => setC(true)}>Open C</button>
      <Drawer open={a} onClose={() => setA(false)} title="Panel A" footer={<button>Save A</button>}>
        <button onClick={() => setB(true)}>Open B from A</button>
      </Drawer>
      <Drawer open={b} onClose={() => setB(false)} title="Panel B" size="lg">
        <p>Second panel</p>
      </Drawer>
      <Drawer open={c} onClose={() => setC(false)} title="Panel C" dirty>
        <p>Unsaved typing</p>
      </Drawer>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Page />);
