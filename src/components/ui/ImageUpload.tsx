"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";

interface ImageUploadProps {
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
  upload: (file: File) => Promise<string>;
  shape?: "square" | "circle";
  size?: "sm" | "md" | "lg";
  label?: string;
  disabled?: boolean;
}

const sizeMap = {
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-32 w-32",
};

export function ImageUpload({
  currentUrl,
  onUploaded,
  upload,
  shape = "square",
  size = "md",
  label = "Upload photo",
  disabled = false,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayed = preview ?? currentUrl ?? null;
  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-pixel";
  const sizeClass = sizeMap[size];

  async function handleFile(file: File) {
    setError(null);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);
    try {
      const url = await upload(file);
      onUploaded(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function clearImage() {
    setPreview(null);
    onUploaded("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`relative ${sizeClass} ${shapeClass} border-2 border-dashed border-obsidian-400 bg-obsidian-900 flex items-center justify-center cursor-pointer hover:border-ember-500 transition-colors group overflow-hidden`}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        role="button"
        aria-label={label}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        {displayed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayed}
            alt="Preview"
            className={`absolute inset-0 w-full h-full object-cover ${shapeClass}`}
          />
        ) : null}

        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-1 transition-opacity ${
            displayed && !uploading ? "opacity-0 group-hover:opacity-100 bg-obsidian-900/70" : "opacity-100"
          }`}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 text-ember-400 animate-spin" />
          ) : (
            <>
              <Camera className="h-5 w-5 text-ash-400 group-hover:text-ember-400 transition-colors" />
              <span className="text-[10px] text-ash-500 group-hover:text-ash-300 transition-colors text-center px-1 leading-tight">
                {displayed ? "Change" : label}
              </span>
            </>
          )}
        </div>

        {displayed && !uploading && (
          <button
            type="button"
            aria-label="Remove image"
            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-obsidian-800/90 flex items-center justify-center text-ash-400 hover:text-crimson-400 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              clearImage();
            }}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {error && <p className="text-xs text-crimson-500">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled || uploading}
        onChange={handleChange}
      />
    </div>
  );
}
