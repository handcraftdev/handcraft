"use client";

import { useState } from "react";

interface TelevisionMetadataFormProps {
  typeMetadata: Record<string, any>;
  onUpdate: (field: string, value: any) => void;
}

export default function TelevisionMetadataForm({
  typeMetadata,
  onUpdate,
}: TelevisionMetadataFormProps) {
  const [castInput, setCastInput] = useState('');
  const cast = typeMetadata.cast || [];

  const handleAddCast = () => {
    if (castInput.trim()) {
      const newCast = [...cast, castInput.trim()];
      onUpdate('cast', newCast);
      setCastInput('');
    }
  };

  const handleRemoveCast = (index: number) => {
    const newCast = cast.filter((_: any, i: number) => i !== index);
    onUpdate('cast', newCast);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">
          Show Name
        </label>
        <input
          type="text"
          value={typeMetadata.showName || ''}
          onChange={(e) => onUpdate('showName', e.target.value)}
          placeholder="Series title"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">
            Season Number
          </label>
          <input
            type="number"
            value={typeMetadata.seasonNumber || ''}
            onChange={(e) => onUpdate('seasonNumber', parseInt(e.target.value) || '')}
            placeholder="1"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">
            Episode Number
          </label>
          <input
            type="number"
            value={typeMetadata.episodeNumber || ''}
            onChange={(e) => onUpdate('episodeNumber', parseInt(e.target.value) || '')}
            placeholder="1"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">
            Runtime (min)
          </label>
          <input
            type="number"
            value={typeMetadata.runtime || ''}
            onChange={(e) => onUpdate('runtime', parseInt(e.target.value) || '')}
            placeholder="45"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">
          Episode Title
        </label>
        <input
          type="text"
          value={typeMetadata.episodeTitle || ''}
          onChange={(e) => onUpdate('episodeTitle', e.target.value)}
          placeholder="Episode title"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">
          Director
        </label>
        <input
          type="text"
          value={typeMetadata.director || ''}
          onChange={(e) => onUpdate('director', e.target.value)}
          placeholder="Director name"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">
          Cast
        </label>
        <div className="space-y-2">
          {cast.map((actor: string, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={actor}
                readOnly
                className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/90"
              />
              <button
                type="button"
                onClick={() => handleRemoveCast(index)}
                className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={castInput}
              onChange={(e) => setCastInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCast())}
              placeholder="Add cast member"
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
            />
            <button
              type="button"
              onClick={handleAddCast}
              className="px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">
          Next Episode Hint
        </label>
        <input
          type="text"
          value={typeMetadata.nextEpisodeHint || ''}
          onChange={(e) => onUpdate('nextEpisodeHint', e.target.value)}
          placeholder="Teaser for next episode"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>
    </div>
  );
}
