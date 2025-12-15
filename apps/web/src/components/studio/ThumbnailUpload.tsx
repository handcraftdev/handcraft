"use client";

import { useState, useRef } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

interface ThumbnailUploadProps {
  thumbnailCid: string | null;
  onUpload: (cid: string) => void;
  label?: string;
}

export function ThumbnailUpload({ thumbnailCid, onUpload, label = "Thumbnail" }: ThumbnailUploadProps) {
  const { session } = useSupabaseAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete a CID from IPFS (fire and forget - don't block UI)
  const deleteFromIpfs = async (cid: string) => {
    if (!cid || !session?.access_token) return;
    try {
      await fetch('/api/upload/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ cid }),
      });
    } catch (err) {
      console.error('Failed to delete old thumbnail from IPFS:', err);
      // Don't show error to user - this is cleanup, not critical
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.access_token) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB for thumbnails)
    if (file.size > 5 * 1024 * 1024) {
      setError('Thumbnail must be less than 5MB');
      return;
    }

    setError(null);
    setIsUploading(true);

    // Store old CID to delete after successful upload
    const oldCid = thumbnailCid;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('encrypt', 'false');

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      onUpload(data.cid);

      // Delete old thumbnail from IPFS (after successful upload)
      if (oldCid) {
        deleteFromIpfs(oldCid);
      }
    } catch (err) {
      console.error('Thumbnail upload error:', err);
      setError('Failed to upload thumbnail');
    } finally {
      setIsUploading(false);
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    // Delete from IPFS before removing
    if (thumbnailCid) {
      deleteFromIpfs(thumbnailCid);
    }
    onUpload('');
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-white/70">{label} *</label>

      {thumbnailCid ? (
        <div className="relative group">
          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-white/5 border border-white/10">
            <img
              src={`https://ipfs.filebase.io/ipfs/${thumbnailCid}`}
              alt="Thumbnail preview"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
              >
                Replace
              </button>
              <button
                onClick={handleRemove}
                disabled={isUploading}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full aspect-video rounded-xl border-2 border-dashed border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04] transition-all flex flex-col items-center justify-center gap-3 disabled:opacity-50"
        >
          {isUploading ? (
            <>
              <svg className="w-8 h-8 text-white/30 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm text-white/40">Uploading...</span>
            </>
          ) : (
            <>
              <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-white/40">Click to upload thumbnail</span>
              <span className="text-xs text-white/30">JPG, PNG, WebP (max 5MB)</span>
            </>
          )}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
