import { useCallback, useState } from "react";

export type UploadStatus = "idle" | "uploading" | "completed" | "error";

export interface UploadItem {
  name: string;
  size?: number;
  type?: string;
  progress: number; // 0-100
  status: UploadStatus;
  file?: File;
  error?: string | null;
}

export function useUploader() {
  const [item, setItem] = useState<UploadItem | null>(null);

  const addFile = useCallback((file: File) => {
    setItem({
      name: file.name,
      size: file.size,
      type: file.type,
      progress: 0,
      status: "idle",
      file,
      error: null,
    });
  }, []);

  const startUpload = useCallback(async () => {
    if (!item || item.status === "uploading") return;

    setItem((prev) => prev ? { ...prev, status: "uploading", progress: 0 } : null);

    try {
      // Simulate upload progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 15) + 5;
        if (progress >= 100) {
          clearInterval(interval);
          return;
        }
        setItem((prev) => prev ? { ...prev, progress: Math.min(100, progress) } : null);
      }, 200);

      // Simulate completion
      await new Promise((resolve) => setTimeout(resolve, 2000));
      clearInterval(interval);

      setItem((prev) =>
        prev ? { ...prev, progress: 100, status: "completed" } : null
      );
    } catch (err) {
      setItem((prev) =>
        prev
          ? {
              ...prev,
              status: "error",
              error: (err as any)?.message || "Upload failed",
            }
          : null
      );
    }
  }, [item]);

  const reset = useCallback(() => {
    setItem(null);
  }, []);

  return {
    item,
    addFile,
    startUpload,
    reset,
  } as const;
}
