"use client";

interface ShortMetadataFormProps {
  typeMetadata: Record<string, any>;
  onUpdate: (field: string, value: any) => void;
}

export default function ShortMetadataForm({
  typeMetadata,
  onUpdate,
}: ShortMetadataFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">
          Creator
        </label>
        <input
          type="text"
          value={typeMetadata.creator || ''}
          onChange={(e) => onUpdate('creator', e.target.value)}
          placeholder="Your username or creator name"
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">
          Hashtags
        </label>
        <input
          type="text"
          value={typeMetadata.hashtags || ''}
          onChange={(e) => onUpdate('hashtags', e.target.value)}
          placeholder="#trending #viral #fun"
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
        />
        <p className="mt-1 text-xs text-white/50">
          Space-separated hashtags (automatically derived from tags if not provided)
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">
          Soundtrack Title (optional)
        </label>
        <input
          type="text"
          value={typeMetadata.soundtrackTitle || ''}
          onChange={(e) => onUpdate('soundtrackTitle', e.target.value)}
          placeholder="Song or audio track title"
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">
          Soundtrack Artist (optional)
        </label>
        <input
          type="text"
          value={typeMetadata.soundtrackArtist || ''}
          onChange={(e) => onUpdate('soundtrackArtist', e.target.value)}
          placeholder="Artist or band name"
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>
    </div>
  );
}
