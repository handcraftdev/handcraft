"use client";

interface AssetMetadataFormProps {
  metadata: Record<string, any>;
  title: string;
  description: string;
  tags: string[];
  onUpdate: (field: string, value: any) => void;
  onBasicUpdate: (field: string, value: any) => void;
}

export function AssetMetadataForm({
  metadata,
  title,
  description,
  tags,
  onUpdate,
  onBasicUpdate,
}: AssetMetadataFormProps) {
  const tagsString = tags.join(', ');
  const handleTagsChange = (value: string) => {
    const tagArray = value.split(',').map(t => t.trim()).filter(Boolean);
    onBasicUpdate('tags', tagArray);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Asset Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => onBasicUpdate('title', e.target.value)}
          placeholder="Asset name"
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">File Type</label>
          <input
            type="text"
            value={metadata.fileType || ''}
            onChange={(e) => onUpdate('fileType', e.target.value)}
            placeholder="e.g., PNG, SVG, GLB"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">File Size</label>
          <input
            type="text"
            value={metadata.fileSize || ''}
            onChange={(e) => onUpdate('fileSize', e.target.value)}
            placeholder="e.g., 2.5 MB"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Resolution</label>
        <input
          type="text"
          value={metadata.resolution || ''}
          onChange={(e) => onUpdate('resolution', e.target.value)}
          placeholder="e.g., 4096x4096 (if applicable)"
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">License</label>
        <select
          value={metadata.license || ''}
          onChange={(e) => onUpdate('license', e.target.value)}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
        >
          <option value="">Select license</option>
          <option value="CC0">CC0 - Public Domain</option>
          <option value="CC-BY">CC BY - Attribution</option>
          <option value="CC-BY-SA">CC BY-SA - Attribution ShareAlike</option>
          <option value="CC-BY-NC">CC BY-NC - Attribution NonCommercial</option>
          <option value="CC-BY-ND">CC BY-ND - Attribution NoDerivs</option>
          <option value="MIT">MIT License</option>
          <option value="Apache-2.0">Apache 2.0</option>
          <option value="proprietary">Proprietary</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Description</label>
        <textarea
          value={description}
          onChange={(e) => onBasicUpdate('description', e.target.value)}
          placeholder="Describe this asset..."
          rows={3}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90 resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Usage Instructions</label>
        <textarea
          value={metadata.usageInstructions || ''}
          onChange={(e) => onUpdate('usageInstructions', e.target.value)}
          placeholder="How to use this asset, requirements, compatibility notes..."
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
