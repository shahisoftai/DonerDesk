"use client";
import { useState } from "react";
import { markNotificationReadAction } from "@/lib/actions/notifications";
import { Button } from "@/components/ui/Button";

export function MarkReadButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function markRead() {
    setPending(true);
    const result = await markNotificationReadAction(id);
    setPending(false);
    if (result.ok) {
      setDone(true);
      window.location.reload();
    }
  }

  return (
    <Button variant="secondary" size="sm" pending={pending} onClick={markRead} disabled={done}>
      {done ? "Read" : "Mark as read"}
    </Button>
  );
}
