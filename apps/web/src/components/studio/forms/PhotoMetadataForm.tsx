"use client";

interface PhotoMetadataFormProps {
  contentType: number;
  metadata: Record<string, any>;
  title: string;
  description: string;
  tags: string[];
  onUpdate: (field: string, value: any) => void;
  onBasicUpdate: (field: string, value: any) => void;
  isEditMode?: boolean;
}

export function PhotoMetadataForm({
  contentType,
  metadata,
  title,
  description,
  tags,
  onUpdate,
  onBasicUpdate,
  isEditMode = false,
}: PhotoMetadataFormProps) {
  const tagsString = tags.join(', ');
  const handleTagsChange = (value: string) => {
    const tagArray = value.split(',').map(t => t.trim()).filter(Boolean);
    onBasicUpdate('tags', tagArray);
  };

  // 8 = Photo, 9 = Artwork
  if (contentType === 9) {
    // Artwork
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Artwork Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => onBasicUpdate('title', e.target.value)}
            placeholder="Title"
            disabled={isEditMode}
            className={`w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90 ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
          {isEditMode && <p className="text-xs text-amber-400/70 mt-1">Title cannot be changed after publishing</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-white/70">Artist</label>
            <input
              type="text"
              value={metadata.artist || ''}
              onChange={(e) => onUpdate('artist', e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-white/70">Medium</label>
            <input
              type="text"
              value={metadata.medium || ''}
              onChange={(e) => onUpdate('medium', e.target.value)}
              placeholder="Digital, 3D..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Description</label>
          <textarea
            value={description}
            onChange={(e) => onBasicUpdate('description', e.target.value)}
            placeholder="About this artwork..."
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

  // Photo (8)
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => onBasicUpdate('title', e.target.value)}
          placeholder="Photo title"
          disabled={isEditMode}
          className={`w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90 ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        {isEditMode && <p className="text-xs text-amber-400/70 mt-1">Title cannot be changed after publishing</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Location</label>
          <input
            type="text"
            value={metadata.location || ''}
            onChange={(e) => onUpdate('location', e.target.value)}
            placeholder="City, Country"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Date Taken</label>
          <input
            type="date"
            value={metadata.dateTaken || ''}
            onChange={(e) => onUpdate('dateTaken', e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Description</label>
        <textarea
          value={description}
          onChange={(e) => onBasicUpdate('description', e.target.value)}
          placeholder="Describe your photo..."
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
