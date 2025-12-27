"use client";

import { useState } from "react";

interface MovieMetadataFormProps {
  typeMetadata: Record<string, any>;
  onUpdate: (field: string, value: any) => void;
}

interface ChapterEntry {
  title: string;
  startTime: number;
}

export default function MovieMetadataForm({
  typeMetadata,
  onUpdate,
}: MovieMetadataFormProps) {
  const [castInput, setCastInput] = useState('');
  const cast = typeMetadata.cast || [];
  const chapters = typeMetadata.chapters || [];

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

  const handleAddChapter = () => {
    const newChapter: ChapterEntry = { title: '', startTime: 0 };
    onUpdate('chapters', [...chapters, newChapter]);
  };

  const handleUpdateChapter = (index: number, field: string, value: any) => {
    const newChapters = [...chapters];
    newChapters[index] = { ...newChapters[index], [field]: value };
    onUpdate('chapters', newChapters);
  };

  const handleRemoveChapter = (index: number) => {
    const newChapters = chapters.filter((_: any, i: number) => i !== index);
    onUpdate('chapters', newChapters);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">
            Runtime (minutes)
          </label>
          <input
            type="number"
            value={typeMetadata.runtime || ''}
            onChange={(e) => onUpdate('runtime', parseInt(e.target.value) || '')}
            placeholder="120"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">
            Rating
          </label>
          <select
            value={typeMetadata.rating || ''}
            onChange={(e) => onUpdate('rating', e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          >
            <option value="">Select rating</option>
            <option value="G">G</option>
            <option value="PG">PG</option>
            <option value="PG-13">PG-13</option>
            <option value="R">R</option>
            <option value="NC-17">NC-17</option>
            <option value="NR">Not Rated</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">
          Genre
        </label>
        <input
          type="text"
          value={typeMetadata.genre || ''}
          onChange={(e) => onUpdate('genre', e.target.value)}
          placeholder="Action, Drama, Sci-Fi..."
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">
          Studio
        </label>
        <input
          type="text"
          value={typeMetadata.studio || ''}
          onChange={(e) => onUpdate('studio', e.target.value)}
          placeholder="Production studio"
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
          Chapters
        </label>
        <div className="space-y-2">
          {chapters.map((chapter: ChapterEntry, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={chapter.title}
                onChange={(e) => handleUpdateChapter(index, 'title', e.target.value)}
                placeholder="Chapter title"
                className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/90"
              />
              <input
                type="number"
                value={chapter.startTime}
                onChange={(e) => handleUpdateChapter(index, 'startTime', parseInt(e.target.value) || 0)}
                placeholder="Start (sec)"
                className="w-32 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/90"
              />
              <button
                type="button"
                onClick={() => handleRemoveChapter(index)}
                className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddChapter}
            className="w-full px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 transition-colors"
          >
            Add Chapter
          </button>
        </div>
      </div>
    </div>
  );
}
