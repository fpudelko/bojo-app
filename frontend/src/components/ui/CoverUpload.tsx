'use client';

import { useRef, useState } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Props {
  currentUrl?: string;
  path: string; // e.g. 'events/abc123/cover' or 'groups/def456/cover'
  onSaved: (url: string | null) => void;
  className?: string;
}

/**
 * Overlay button that sits on top of a hero/cover image area.
 * Click → file picker → uploads to storage/covers → calls onSaved(url).
 * Shows a remove button when there's an existing cover.
 */
export default function CoverUpload({ currentUrl, path, onSaved, className = '' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { setError('Maksymalny rozmiar: 5 MB'); return; }
    if (!file.type.startsWith('image/')) { setError('Tylko pliki graficzne'); return; }
    setError('');
    setUploading(true);
    try {
      const { error: upErr } = await supabase.storage
        .from('covers')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('covers').getPublicUrl(path);
      // bust cache with a timestamp param
      onSaved(`${data.publicUrl}?t=${Date.now()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd uploadu');
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    setUploading(true);
    try {
      await supabase.storage.from('covers').remove([path]);
      onSaved(null);
    } catch { /* ignore */ }
    finally { setUploading(false); }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-1.5 rounded-xl bg-black/40 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/55 active:scale-95 transition disabled:opacity-50"
      >
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
        {currentUrl ? 'Zmień zdjęcie' : 'Dodaj zdjęcie'}
      </button>
      {currentUrl && !uploading && (
        <button
          type="button"
          onClick={remove}
          className="inline-flex items-center gap-1 rounded-xl bg-black/40 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-red-600/70 active:scale-95 transition"
          title="Usuń zdjęcie"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {error && <p className="text-xs text-red-300 bg-black/40 px-2 py-1 rounded-lg">{error}</p>}
    </div>
  );
}
