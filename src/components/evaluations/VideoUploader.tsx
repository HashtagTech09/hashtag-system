import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, Video, X, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  label: string;
  accept: string;
  required?: boolean;
  pathPrefix: string; // e.g. "1/instructor_5/2026-06-01/sessions/123"
  onUploaded: (storagePath: string, mimeType: string) => void;
  onCleared?: () => void;
}

export function VideoUploader({ label, accept, required, pathPrefix, onUploaded, onCleared }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setProgress(0);
    const ext = file.name.split(".").pop() || "bin";
    const path = `${pathPrefix}/${crypto.randomUUID()}.${ext}`;
    try {
      const { error } = await supabase.storage.from("class-media").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      setProgress(100);
      setUploadedName(file.name);
      onUploaded(path, file.type);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
      setProgress(null);
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </span>
        </div>
        {uploadedName && (
          <button
            type="button"
            onClick={() => {
              setUploadedName(null);
              setProgress(null);
              onCleared?.();
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {uploadedName ? (
        <div className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          <span className="truncate">{uploadedName}</span>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={progress !== null && progress < 100}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            {progress !== null && progress < 100 ? "Uploading..." : "Choose file"}
          </Button>
          {progress !== null && progress < 100 && (
            <div className="h-1 bg-muted rounded overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
