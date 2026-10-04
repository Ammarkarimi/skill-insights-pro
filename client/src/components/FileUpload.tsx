import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Check, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_MB = 5;

interface FileUploadProps {
  /** Called with the full current list whenever files are added or removed. */
  onFilesChange: (files: File[]) => void;
  acceptedTypes?: string;
  multiple?: boolean;
  maxFiles?: number;
  className?: string;
  busy?: boolean;
  busyLabel?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFilesChange,
  acceptedTypes = ".pdf,.docx,.txt",
  multiple = false,
  maxFiles = 5,
  className,
  busy = false,
  busyLabel = "Processing...",
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const types = acceptedTypes.split(",").map((t) => t.trim().toLowerCase());

  const update = (next: File[]) => {
    setFiles(next);
    onFilesChange(next);
  };

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    setError(null);
    const picked = Array.from(incoming);
    for (const file of picked) {
      const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
      if (!types.includes(ext)) {
        setError(`'${file.name}' is not supported. Use ${types.join(", ")} files.`);
        return;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        setError(`'${file.name}' is larger than ${MAX_MB} MB.`);
        return;
      }
    }
    if (!multiple) {
      update(picked.slice(0, 1));
      return;
    }
    const merged = [...files];
    for (const file of picked) {
      if (!merged.some((f) => f.name === file.name && f.size === file.size)) merged.push(file);
    }
    if (merged.length > maxFiles) {
      setError(`You can upload up to ${maxFiles} files.`);
      return;
    }
    update(merged);
  };

  return (
    <div className={cn("w-full", className)}>
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors flex flex-col items-center justify-center",
          isDragging ? "border-primary bg-primary/5" : "border-gray-300 hover:border-primary",
          busy && "opacity-70 pointer-events-none",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
      >
        <input
          type="file"
          ref={inputRef}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = ""; // allow re-selecting the same file
          }}
          className="hidden"
          accept={acceptedTypes}
          multiple={multiple}
        />
        {busy ? (
          <div className="flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-gray-500">{busyLabel}</p>
          </div>
        ) : (
          <>
            <Upload size={36} className="text-gray-400 mb-3" />
            <h3 className="text-lg font-medium text-gray-700 mb-1">
              {multiple ? "Upload your files" : "Upload your file"}
            </h3>
            <p className="text-sm text-gray-500 mb-3">Drag and drop or click to browse</p>
            <p className="text-xs text-gray-400">
              {types.join(", ")} up to {MAX_MB} MB{multiple && ` (max ${maxFiles} files)`}
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-50 text-red-700 rounded-md flex items-center gap-2">
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((file, index) => (
            <li key={file.name + file.size} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
              <div className="flex items-center gap-2 min-w-0">
                <Check size={16} className="text-green-500 shrink-0" />
                <span className="text-sm truncate">{file.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => update(files.filter((_, i) => i !== index))}
                className="text-gray-500 hover:text-red-500"
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FileUpload;
