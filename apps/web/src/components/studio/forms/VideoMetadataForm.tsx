"use client";

interface VideoMetadataFormProps {
  contentType: number;
  metadata: Record<string, any>;
  title: string;
  description: string;
  tags: string[];
  onUpdate: (field: string, value: any) => void;
  onBasicUpdate: (field: string, value: any) => void;
}

export function VideoMetadataForm({
  contentType,
  metadata,
  title,
  description,
  tags,
  onUpdate,
  onBasicUpdate,
}: VideoMetadataFormProps) {
  const tagsString = tags.join(', ');

  const handleTagsChange = (value: string) => {
    const tagArray = value.split(',').map(t => t.trim()).filter(Boolean);
    onBasicUpdate('tags', tagArray);
  };

  // 1 = Movie, 2 = Television, 3 = Music Video
  if (contentType === 1) {
    // Movie form
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => onBasicUpdate('title', e.target.value)}
            placeholder="Movie title"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-white/70">Director</label>
            <input
              type="text"
              value={metadata.director || ''}
              onChange={(e) => onUpdate('director', e.target.value)}
              placeholder="Director name"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-white/70">Year</label>
            <input
              type="number"
              value={metadata.year || ''}
              onChange={(e) => onUpdate('year', e.target.value)}
              placeholder="2024"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Cast</label>
          <input
            type="text"
            value={metadata.cast || ''}
            onChange={(e) => onUpdate('cast', e.target.value)}
            placeholder="Actor 1, Actor 2..."
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Description</label>
          <textarea
            value={description}
            onChange={(e) => onBasicUpdate('description', e.target.value)}
            placeholder="Movie synopsis..."
            rows={3}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Genre</label>
          <input
            type="text"
            value={metadata.genre || ''}
            onChange={(e) => onUpdate('genre', e.target.value)}
            placeholder="Action, Drama..."
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
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

  if (contentType === 2) {
    // Television form
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Show Name *</label>
          <input
            type="text"
            value={metadata.showName || ''}
            onChange={(e) => onUpdate('showName', e.target.value)}
            placeholder="Series title"
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
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-white/70">Season</label>
            <input
              type="number"
              value={metadata.season || ''}
              onChange={(e) => onUpdate('season', e.target.value)}
              placeholder="1"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-white/70">Episode</label>
            <input
              type="number"
              value={metadata.episode || ''}
              onChange={(e) => onUpdate('episode', e.target.value)}
              placeholder="1"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Synopsis</label>
          <textarea
            value={description}
            onChange={(e) => onBasicUpdate('description', e.target.value)}
            placeholder="Episode synopsis..."
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

  // Generic video form (0, 3, 4)
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => onBasicUpdate('title', e.target.value)}
          placeholder="Video title"
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Description</label>
        <textarea
          value={description}
          onChange={(e) => onBasicUpdate('description', e.target.value)}
          placeholder="Describe your video..."
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
