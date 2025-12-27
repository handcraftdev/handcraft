"use client";

interface MusicVideoMetadataFormProps {
  typeMetadata: Record<string, any>;
  onUpdate: (field: string, value: any) => void;
}

export default function MusicVideoMetadataForm({
  typeMetadata,
  onUpdate,
}: MusicVideoMetadataFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">
          Artist
        </label>
        <input
          type="text"
          value={typeMetadata.artist || ''}
          onChange={(e) => onUpdate('artist', e.target.value)}
          placeholder="Artist or band name"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">
            Album (optional)
          </label>
          <input
            type="text"
            value={typeMetadata.album || ''}
            onChange={(e) => onUpdate('album', e.target.value)}
            placeholder="Album name"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">
            Release Year
          </label>
          <input
            type="number"
            value={typeMetadata.releaseYear || ''}
            onChange={(e) => onUpdate('releaseYear', parseInt(e.target.value) || '')}
            placeholder="2024"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">
          Director
        </label>
        <input
          type="text"
          value={typeMetadata.director || ''}
          onChange={(e) => onUpdate('director', e.target.value)}
          placeholder="Video director"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">
          Genre
        </label>
        <input
          type="text"
          value={typeMetadata.genre || ''}
          onChange={(e) => onUpdate('genre', e.target.value)}
          placeholder="Pop, Rock, Hip-Hop..."
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">
          Lyrics (optional)
        </label>
        <textarea
          value={typeMetadata.lyrics || ''}
          onChange={(e) => onUpdate('lyrics', e.target.value)}
          placeholder="Song lyrics..."
          rows={8}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90 resize-none font-mono text-sm"
        />
      </div>
    </div>
  );
}
