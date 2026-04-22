"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Horizontal strip of reference-image thumbnails with drag/drop +
 * paste + file-picker upload. Used under each character card and
 * inside the aesthetic-bible section.
 *
 * `target` is the string the upload endpoint understands:
 *   "bible"                — aesthetic bible mood board
 *   "character:<Name>"     — per-character references
 *
 * The component holds the list of paths locally so uploads and
 * deletions feel instant; on success it also calls router.refresh()
 * so the server-rendered edit form stays in sync for the next mount.
 */
export function ReferenceStrip({
  projectId,
  target,
  label,
  initialPaths,
  disabled,
}: {
  projectId: string;
  target: string;
  label: string;
  initialPaths: string[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [paths, setPaths] = useState<string[]>(initialPaths);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Array<{ id: string; previewUrl: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sign preview URLs whenever the stored paths change.
  // Orphan keys for deleted paths are harmless — the render only
  // iterates `paths`, so stale entries never surface. Avoiding a
  // synchronous reset here keeps us clear of the setState-in-effect
  // lint rule.
  useEffect(() => {
    if (paths.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/references/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: projectId, paths }),
        });
        if (!res.ok) return;
        const body = (await res.json()) as { urls: Record<string, string | null> };
        if (cancelled) return;
        setSignedUrls((prev) => {
          const next = { ...prev };
          for (const [p, u] of Object.entries(body.urls)) {
            if (u) next[p] = u;
          }
          return next;
        });
      } catch {
        /* retry on next mount */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, paths]);

  const uploadOne = useCallback(
    async (file: File) => {
      const id = `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const previewUrl = URL.createObjectURL(file);
      setUploading((prev) => [...prev, { id, previewUrl }]);
      setError(null);
      try {
        const form = new FormData();
        form.append("project_id", projectId);
        form.append("target", target);
        form.append("file", file);
        const res = await fetch("/api/references/upload", {
          method: "POST",
          body: form,
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? res.statusText);
        setPaths((prev) => [...prev, body.path as string]);
        if (body.preview_url) {
          setSignedUrls((prev) => ({ ...prev, [body.path]: body.preview_url }));
        }
        // Refresh the server component so next render carries the
        // new path in its initial state.
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setUploading((prev) => {
          const removed = prev.find((u) => u.id === id);
          if (removed) URL.revokeObjectURL(removed.previewUrl);
          return prev.filter((u) => u.id !== id);
        });
      }
    },
    [projectId, target, router],
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      for (const f of list) void uploadOne(f);
    },
    [uploadOne],
  );

  const removePath = useCallback(
    async (path: string) => {
      // Optimistic removal.
      setPaths((prev) => prev.filter((p) => p !== path));
      setSignedUrls((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
      try {
        const res = await fetch("/api/references", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: projectId, path }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? res.statusText);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        // Put it back if delete failed server-side.
        setPaths((prev) => (prev.includes(path) ? prev : [...prev, path]));
      }
    },
    [projectId, router],
  );

  // Document-level paste listener: if this strip is the most recently
  // focused one (tracked via hover? no — simplest: accept paste when
  // any of our inputs is focused). For the edit page a single active
  // strip at a time is the common case.
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onPaste = (e: ClipboardEvent) => {
      if (!el.contains(document.activeElement)) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === "file" && it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        addFiles(files);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [addFiles]);

  const total = paths.length + uploading.length;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragActive(true);
        }
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
      }}
      className={`flex flex-col gap-2 p-2 bg-paper border border-ink/10 outline-none transition-colors ${
        dragActive ? "border-sepia-deep bg-paper-deep" : ""
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-hand text-sepia-deep text-sm">{label}</span>
        <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/50">
          {total === 0 ? "empty" : `${total}`}
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap gap-2">
        {paths.map((path) => (
          <div
            key={path}
            className="relative w-20 h-20 bg-paper-deep border border-ink/20 overflow-hidden"
          >
            {signedUrls[path] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signedUrls[path]}
                alt="Reference"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-ink/40 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <button
              type="button"
              aria-label="Remove reference"
              onClick={() => removePath(path)}
              disabled={disabled}
              className="absolute -top-1 -right-1 w-6 h-6 bg-paper border border-ink/40 rounded-full font-display text-sm text-ink-soft hover:text-ink flex items-center justify-center leading-none"
            >
              &times;
            </button>
          </div>
        ))}

        {uploading.map((u) => (
          <div
            key={u.id}
            className="relative w-20 h-20 bg-paper-deep border border-ink/20 overflow-hidden opacity-80"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={u.previewUrl}
              alt="Uploading"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-paper/60">
              <div className="w-5 h-5 border-2 border-ink/60 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          aria-label={`Add reference to ${label}`}
          className="w-20 h-20 bg-paper-deep border border-dashed border-ink/30 text-ink-soft hover:border-ink hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-0.5 transition-colors"
        >
          <span className="font-display text-2xl leading-none">+</span>
          <span className="font-body text-[9px] uppercase tracking-widest">
            drop · paste · pick
          </span>
        </button>
      </div>

      {error ? (
        <p aria-live="polite" className="font-hand text-sm text-red-grease">
          {error}
        </p>
      ) : null}
    </div>
  );
}
