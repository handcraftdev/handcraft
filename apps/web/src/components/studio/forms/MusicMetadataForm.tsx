"use client";

interface MusicMetadataFormProps {
  contentType: number;
  metadata: Record<string, any>;
  title: string;
  description: string;
  tags: string[];
  onUpdate: (field: string, value: any) => void;
  onBasicUpdate: (field: string, value: any) => void;
  isEditMode?: boolean;
}

export function MusicMetadataForm({
  contentType,
  metadata,
  title,
  description,
  tags,
  onUpdate,
  onBasicUpdate,
  isEditMode = false,
}: MusicMetadataFormProps) {
  const tagsString = tags.join(', ');
  const handleTagsChange = (value: string) => {
    const tagArray = value.split(',').map(t => t.trim()).filter(Boolean);
    onBasicUpdate('tags', tagArray);
  };

  // 5 = Music, 6 = Podcast, 7 = Audiobook
  if (contentType === 6) {
    // Podcast
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Show Name *</label>
          <input
            type="text"
            value={metadata.showName || ''}
            onChange={(e) => onUpdate('showName', e.target.value)}
            placeholder="Podcast name"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Episode Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => onBasicUpdate('title', e.target.value)}
            placeholder="Episode title"
            disabled={isEditMode}
            className={`w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90 ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
          {isEditMode && <p className="text-xs text-amber-400/70 mt-1">Title cannot be changed after publishing</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Host(s)</label>
          <input
            type="text"
            value={metadata.host || ''}
            onChange={(e) => onUpdate('host', e.target.value)}
            placeholder="Host names"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Show Notes</label>
          <textarea
            value={description}
            onChange={(e) => onBasicUpdate('description', e.target.value)}
            placeholder="Episode description..."
            rows={3}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Tags</label>
          <input
            type="text"
            value={tagsString}
            onChange={(e) => handleTagsChange(e.target.value)}
            placeholder="comma, separated, tags"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
      </div>
    );
  }

  if (contentType === 7) {
    // Audiobook
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Book Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => onBasicUpdate('title', e.target.value)}
            placeholder="Book title"
            disabled={isEditMode}
            className={`w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90 ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
          {isEditMode && <p className="text-xs text-amber-400/70 mt-1">Title cannot be changed after publishing</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-white/70">Author *</label>
            <input
              type="text"
              value={metadata.author || ''}
              onChange={(e) => onUpdate('author', e.target.value)}
              placeholder="Author name"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-white/70">Narrator</label>
            <input
              type="text"
              value={metadata.narrator || ''}
              onChange={(e) => onUpdate('narrator', e.target.value)}
              placeholder="Narrator name"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Description</label>
          <textarea
            value={description}
            onChange={(e) => onBasicUpdate('description', e.target.value)}
            placeholder="Book description..."
            rows={3}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Tags</label>
          <input
            type="text"
            value={tagsString}
            onChange={(e) => handleTagsChange(e.target.value)}
            placeholder="comma, separated, tags"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
      </div>
    );
  }

  // Music (5)
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Track Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => onBasicUpdate('title', e.target.value)}
          placeholder="Song title"
          disabled={isEditMode}
          className={`w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90 ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        {isEditMode && <p className="text-xs text-amber-400/70 mt-1">Title cannot be changed after publishing</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Artist *</label>
          <input
            type="text"
            value={metadata.artist || ''}
            onChange={(e) => onUpdate('artist', e.target.value)}
            placeholder="Artist name"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Album</label>
          <input
            type="text"
            value={metadata.album || ''}
            onChange={(e) => onUpdate('album', e.target.value)}
            placeholder="Album name"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Genre</label>
        <input
          type="text"
          value={metadata.genre || ''}
          onChange={(e) => onUpdate('genre', e.target.value)}
          placeholder="Electronic, Jazz..."
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Description</label>
        <textarea
          value={description}
          onChange={(e) => onBasicUpdate('description', e.target.value)}
          placeholder="About this track..."
          rows={2}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90 resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Tags</label>
        <input
          type="text"
          value={tagsString}
          onChange={(e) => handleTagsChange(e.target.value)}
          placeholder="comma, separated, tags"
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>
    </div>
  );
}
