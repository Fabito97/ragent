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

type UploadExecutor = (formData: FormData) => Promise<unknown>;

interface StartUploadOptions {
  onSuccess?: () => void;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useUploader() {
  const [item, setItem] = useState<UploadItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processMessage, setProcessMessage] = useState<string | null>(null);

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

  const startUpload = useCallback(async (upload: UploadExecutor, options?: StartUploadOptions) => {
    if (!item || !item.file || item.status === "uploading") return;

    setIsProcessing(true);
    setProcessMessage("Uploading document...");
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

      const form = new FormData();
      form.append("file", item.file, item.name);

      // Keep a minimum simulation time so progress is visible.
      await Promise.all([upload(form), wait(2000)]);
      clearInterval(interval);

      setItem((prev) =>
        prev ? { ...prev, progress: 100, status: "completed" } : null
      );
      setProcessMessage("Upload completed.");

      await wait(900);
      setIsProcessing(false);
      setProcessMessage(null);
      options?.onSuccess?.();
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
      setProcessMessage("Upload failed. Please try again or check the file.");
      setIsProcessing(false);
    }
  }, [item]);

  const reset = useCallback(() => {
    setItem(null);
    setIsProcessing(false);
    setProcessMessage(null);
  }, []);

  return {
    item,
    isProcessing,
    processMessage,
    addFile,
    startUpload,
    reset,
  } as const;
}
