import { Upload } from "lucide-react";
import { useRef } from "react";

import { useMediaMutations } from "@/api/hooks";
import type { Media } from "@/api/types";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/components/ui/feedback";

export const ACCEPTED_TYPES = "image/png,image/jpeg,image/gif,image/webp,image/avif,application/pdf";
export const MAX_UPLOAD_MB = 10;

export function UploadButton({ onUploaded }: { onUploaded?: (media: Media) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const { upload } = useMediaMutations();

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED_TYPES}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
            window.alert(`El archivo supera ${MAX_UPLOAD_MB} MB.`);
            return;
          }
          upload.mutate(
            { file },
            {
              onSuccess: (media) => onUploaded?.(media),
              onError: (error) => window.alert(errorMessage(error)),
            },
          );
        }}
      />
      <Button onClick={() => input.current?.click()} disabled={upload.isPending}>
        <Upload className="size-4" aria-hidden />
        {upload.isPending ? "Subiendo…" : "Subir archivo"}
      </Button>
    </>
  );
}
