import { useState, useRef, useCallback } from 'react';
import { Upload, X, GripVertical } from 'lucide-react';
import type { Screenshot } from '../lib/types';

interface ScreenshotUploaderProps {
  screenshots: Screenshot[];
  onAdd: (file: File) => void;
  onRemove: (id: string) => void;
  onReorder: (from: number, to: number) => void;
}

export function ScreenshotUploader({ screenshots, onAdd, onRemove, onReorder }: ScreenshotUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
      files.forEach(onAdd);
    },
    [onAdd]
  );

  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-[var(--radius-lg)] p-8 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
            : 'border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-2)]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) Array.from(e.target.files).forEach(onAdd);
          }}
        />
        <Upload size={32} className="mx-auto mb-3 text-[var(--text-tertiary)]" />
        <p className="text-sm font-medium text-[var(--text-primary)]">
          Glissez vos screenshots ici
        </p>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">
          PNG, JPG · ou cliquez pour parcourir
        </p>
      </div>

      {/* List */}
      {screenshots.length > 0 && (
        <div className="mt-4 space-y-2">
          {screenshots.map((s, i) => (
            <div
              key={s.id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null && dragIndex !== i) onReorder(dragIndex, i);
                setDragIndex(null);
              }}
              className="flex items-center gap-3 p-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] hover:border-[var(--border-default)] transition-colors group"
            >
              <GripVertical size={16} className="text-[var(--text-tertiary)] cursor-grab flex-shrink-0" />
              <div className="w-12 h-12 rounded-[var(--radius-sm)] bg-[var(--bg-surface-3)] flex-shrink-0 overflow-hidden">
                <img src={s.storage_path} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                  Écran {i + 1}
                </div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  {s.duration_seconds}s · {s.transition_type}
                </div>
              </div>
              <button
                onClick={() => onRemove(s.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-tertiary)] hover:text-[var(--danger)] p-1"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
