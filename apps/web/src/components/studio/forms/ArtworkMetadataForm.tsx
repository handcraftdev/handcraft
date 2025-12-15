"use client";

interface ArtworkMetadataFormProps {
  metadata: Record<string, any>;
  title: string;
  description: string;
  tags: string[];
  onUpdate: (field: string, value: any) => void;
  onBasicUpdate: (field: string, value: any) => void;
}

export function ArtworkMetadataForm({
  metadata,
  title,
  description,
  tags,
  onUpdate,
  onBasicUpdate,
}: ArtworkMetadataFormProps) {
  const tagsString = tags.join(', ');
  const handleTagsChange = (value: string) => {
    const tagArray = value.split(',').map(t => t.trim()).filter(Boolean);
    onBasicUpdate('tags', tagArray);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Artwork Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => onBasicUpdate('title', e.target.value)}
          placeholder="Title"
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
        />
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
          <select
            value={metadata.medium || ''}
            onChange={(e) => onUpdate('medium', e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          >
            <option value="">Select medium</option>
            <option value="oil">Oil</option>
            <option value="digital">Digital</option>
            <option value="watercolor">Watercolor</option>
            <option value="acrylic">Acrylic</option>
            <option value="pencil">Pencil</option>
            <option value="charcoal">Charcoal</option>
            <option value="mixed">Mixed Media</option>
            <option value="sculpture">Sculpture</option>
            <option value="3d">3D</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Width</label>
          <input
            type="text"
            value={metadata.dimensions?.width || ''}
            onChange={(e) => onUpdate('dimensions', { ...metadata.dimensions, width: e.target.value })}
            placeholder="e.g., 1920px"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Height</label>
          <input
            type="text"
            value={metadata.dimensions?.height || ''}
            onChange={(e) => onUpdate('dimensions', { ...metadata.dimensions, height: e.target.value })}
            placeholder="e.g., 1080px"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Year Created</label>
          <input
            type="number"
            value={metadata.yearCreated || ''}
            onChange={(e) => onUpdate('yearCreated', e.target.value)}
            placeholder="2024"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Edition</label>
        <input
          type="text"
          value={metadata.edition || ''}
          onChange={(e) => onUpdate('edition', e.target.value)}
          placeholder="e.g., 1/10"
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Description</label>
        <textarea
          value={description}
          onChange={(e) => onBasicUpdate('description', e.target.value)}
          placeholder="About this artwork..."
          rows={3}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90 resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Artist Statement</label>
        <textarea
          value={metadata.artistStatement || ''}
          onChange={(e) => onUpdate('artistStatement', e.target.value)}
          placeholder="Your creative vision and intent..."
          rows={3}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90 resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Provenance</label>
        <textarea
          value={metadata.provenance || ''}
          onChange={(e) => onUpdate('provenance', e.target.value)}
          placeholder="Ownership and exhibition history..."
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
