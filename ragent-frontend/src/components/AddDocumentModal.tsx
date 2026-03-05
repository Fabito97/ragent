import React, { useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { formatBytes } from "../lib/utils";
import { useUploader } from "../hooks/useUploader";
import { useUploadDocumentMutation } from "../store/api/documentsApi";

interface AddDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACCEPTED_FORMATS = [".pdf", ".csv", ".xlsx", ".xls", ".txt"];

const AddDocumentModal: React.FC<AddDocsModalProps> = ({ isOpen, onClose }) => {
  // Hook to manage single file upload
  const { item, addFile, startUpload, reset } = useUploader();


  const [uploadDocument] = useUploadDocumentMutation();


  const [isProcessing, setIsProcessing] = useState(false);

  // Message displayed to user during upload processing
  const [processMessage, setProcessMessage] = useState<string | null>(null);


  const fileInputRef = useRef<HTMLInputElement | null>(null);


  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      addFile(acceptedFiles[0]);
    }
  };

  
  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    noClick: false,
    noKeyboard: false,
    multiple: false,
    useFsAccessApi: false,
  });

  /** Trigger file input click */
  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      addFile(e.target.files[0]);
    }
  };


  const handleDocumentUpload = async () => {
    if (!item || !item.file) return;

    setIsProcessing(true);
    setProcessMessage("Uploading document...");

    try {
      const form = new FormData();
      form.append("file", item.file, item.name);

      await uploadDocument(form).unwrap();

      setProcessMessage("Upload completed.");
      // Small delay so user sees success message before closing
      setTimeout(() => {
        reset();
        setIsProcessing(false);
        setProcessMessage(null);
        onClose();
      }, 900);
    } catch (err) {
      console.error("Upload failed:", err);
      setProcessMessage("Upload failed. Please try again or check the file.");
      setIsProcessing(false);
    }
  };

  // Don't render modal if not open
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center">
      {/* Semi-transparent backdrop that closes modal on click */}
      <div
        className="absolute inset-0 z-10 bg-black opacity-10"
        onClick={onClose}
      />

      {/* Modal container */}
      <div className="relative z-50 bg-white dark:bg-gray-900 dark:border border-gray-500 p-6 rounded-lg w-full max-w-2xl shadow-2xl">
        {/* Header with title and close button */}
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            Add Documents
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-300"
          >
            ✕
          </button>
        </div>

        {/* Main content grid: upload area on left, file preview on right */}
        <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
          {/* File upload section */}
          <div>
            {/* Drag and drop zone */}
            <div
              {...getRootProps()}
              className="border-2 border-dashed border-gray-400 dark:border-gray-600 p-6 rounded-lg text-center cursor-pointer bg-gray-50 dark:bg-gray-800"
            >
              <input
                {...(getInputProps() as any)}
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <div
                onClick={handleFileClick}
                className="flex flex-col items-center gap-2"
              >
                <div className="text-3xl">�</div>
                <p className="text-gray-600 dark:text-gray-300">
                  Drag & Drop file or click to upload
                </p>
                <small className="text-xs text-gray-400">
                  {ACCEPTED_FORMATS.join(", ")}
                </small>
              </div>
            </div>
          
          </div>

          {/* File preview section - displays selected file with progress */}
          <div>
            {!item ? (
              <div className="text-sm text-center text-gray-500">
                No file added. Add a file to begin.
              </div>
            ) : (
              <>
                <h2 className="mb-5">File preview</h2>
                {/* File item */}
                <div className="bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-300">
                  {/* File info row: name, size, and status */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      {/* File type badge */}
                      <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-xs">
                        {item.name.split(".").pop()?.toUpperCase() || "F"}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                          {item.name}
                        </div>
                        {/* Display file size */}
                        <div className="text-xs text-gray-400">
                          {item.size ? formatBytes(item.size) : ""}
                        </div>
                      </div>
                    </div>

                    {/* Upload progress percentage or status */}
                    <div className="text-right text-xs">
                      <div>
                        {item.status === "uploading"
                          ? `${item.progress}%`
                          : item.status}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                    <div
                      style={{ width: `${item.progress}%` }}
                      className={`h-2 bg-emerald-500 transition-all ${
                        item.status === "completed" ? "bg-green-500" : ""
                      }`}
                    />
                  </div>

                  {/* Action button: Remove */}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => reset()}
                      className="px-3 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer with help text and action buttons */}
        <div className="mt-6 flex justify-between items-center">
          <div className="text-xs text-gray-400">
            Need help? Visit our Help Center
          </div>

          <div className="flex gap-2">
            {/* Cancel button */}
            <button
              onClick={() => {
                reset();
                onClose();
              }}
              className="hover:bg-gray-600 dark:text-gray-300 text-gray-500 hover:text-white px-3 rounded-md"
              disabled={isProcessing}
            >
              Cancel
            </button>
            {/* Upload button - triggers upload */}
            <button
              disabled={!item || isProcessing}
              onClick={handleDocumentUpload}
              className={`btn ${
                (!item || isProcessing) && "opacity-50 cursor-disabled"
              } px-2 py-1 rounded-md bg-blue-700 hover:bg-blue-800`}
            >
              {isProcessing ? "Processing..." : "Upload"}
            </button>
          </div>
        </div>

        {/* Processing overlay - shows spinner and message during upload */}
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-lg flex flex-col items-center gap-3 shadow">
              {/* Loading spinner animation */}
              <div className="w-10 h-10 rounded-full border-4 border-t-transparent border-blue-600 animate-spin" />
              {/* Status message */}
              <div className="text-sm text-gray-800 dark:text-gray-100">
                {processMessage}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/** Export component as default export */
export default AddDocumentModal;
