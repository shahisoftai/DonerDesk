"use client";

import { useState } from "react";
import { CommentsThread, type CommentableEntityType } from "./CommentsThread";

/** "Add a comment" until opened, so a page without comments stays as short as before; the thread loads only when opened. */
export function CommentsDisclosure({ entityType, entityId, heading = "Comments" }: { entityType: CommentableEntityType; entityId: string; heading?: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return <button type="button" className="text-sm text-brand-700 underline dark:text-brand-300" onClick={() => setOpen(true)}>Add a comment</button>;
  }
  return <CommentsThread entityType={entityType} entityId={entityId} heading={heading} />;
}
