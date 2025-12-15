"use client";

interface SoftwareMetadataFormProps {
  metadata: Record<string, any>;
  title: string;
  description: string;
  tags: string[];
  onUpdate: (field: string, value: any) => void;
  onBasicUpdate: (field: string, value: any) => void;
}

export function SoftwareMetadataForm({
  metadata,
  title,
  description,
  tags,
  onUpdate,
  onBasicUpdate,
}: SoftwareMetadataFormProps) {
  const tagsString = tags.join(', ');
  const handleTagsChange = (value: string) => {
    const tagArray = value.split(',').map(t => t.trim()).filter(Boolean);
    onBasicUpdate('tags', tagArray);
  };

  const platformOptions = ['Windows', 'macOS', 'Linux', 'Web', 'iOS', 'Android', 'Cross-platform'];
  const selectedPlatforms = metadata.platform || [];

  const handlePlatformToggle = (platform: string) => {
    const newPlatforms = selectedPlatforms.includes(platform)
      ? selectedPlatforms.filter((p: string) => p !== platform)
      : [...selectedPlatforms, platform];
    onUpdate('platform', newPlatforms);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Software Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => onBasicUpdate('title', e.target.value)}
          placeholder="Software name"
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Developer</label>
          <input
            type="text"
            value={metadata.developer || ''}
            onChange={(e) => onUpdate('developer', e.target.value)}
            placeholder="Developer or organization"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Version</label>
          <input
            type="text"
            value={metadata.version || ''}
            onChange={(e) => onUpdate('version', e.target.value)}
            placeholder="e.g., 1.0.0"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Platform</label>
        <div className="grid grid-cols-3 gap-2">
          {platformOptions.map((platform) => (
            <label key={platform} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedPlatforms.includes(platform)}
                onChange={() => handlePlatformToggle(platform)}
                className="w-4 h-4 bg-white/5 border border-white/10 rounded focus:ring-purple-500"
              />
              <span className="text-sm text-white/70">{platform}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">License</label>
        <select
          value={metadata.license || ''}
          onChange={(e) => onUpdate('license', e.target.value)}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
        >
          <option value="">Select license</option>
          <option value="MIT">MIT License</option>
          <option value="Apache-2.0">Apache 2.0</option>
          <option value="GPL-3.0">GPL 3.0</option>
          <option value="BSD-3-Clause">BSD 3-Clause</option>
          <option value="LGPL">LGPL</option>
          <option value="MPL-2.0">Mozilla Public License 2.0</option>
          <option value="proprietary">Proprietary</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Repository URL</label>
        <input
          type="url"
          value={metadata.repositoryUrl || ''}
          onChange={(e) => onUpdate('repositoryUrl', e.target.value)}
          placeholder="https://github.com/..."
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Description</label>
        <textarea
          value={description}
          onChange={(e) => onBasicUpdate('description', e.target.value)}
          placeholder="Software description..."
          rows={3}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90 resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Changelog</label>
        <textarea
          value={metadata.changelog || ''}
          onChange={(e) => onUpdate('changelog', e.target.value)}
          placeholder="Version history and changes..."
          rows={3}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90 resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">System Requirements</label>
        <textarea
          value={metadata.systemRequirements || ''}
          onChange={(e) => onUpdate('systemRequirements', e.target.value)}
          placeholder="Minimum requirements and dependencies..."
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
