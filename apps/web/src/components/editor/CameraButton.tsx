"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { captureFileName } from "@/lib/shared/capture-name";

/** Opens the phone's camera and hands the photo over as a file. On a computer it simply opens the file chooser for images. */
export function CameraButton({ onFiles, label = "Take a photo" }: { onFiles: (files: File[]) => void; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const taken = new Date();
          const files = Array.from(event.target.files ?? []).map(
            (file, i) => new File([file], captureFileName(taken, file.type, i), { type: file.type, lastModified: file.lastModified }),
          );
          if (files.length > 0) onFiles(files);
          event.currentTarget.value = "";
        }}
      />
      <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
        {label}
      </Button>
    </>
  );
}
