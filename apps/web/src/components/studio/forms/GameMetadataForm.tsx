"use client";

interface GameMetadataFormProps {
  metadata: Record<string, any>;
  title: string;
  description: string;
  tags: string[];
  onUpdate: (field: string, value: any) => void;
  onBasicUpdate: (field: string, value: any) => void;
}

export function GameMetadataForm({
  metadata,
  title,
  description,
  tags,
  onUpdate,
  onBasicUpdate,
}: GameMetadataFormProps) {
  const tagsString = tags.join(', ');
  const handleTagsChange = (value: string) => {
    const tagArray = value.split(',').map(t => t.trim()).filter(Boolean);
    onBasicUpdate('tags', tagArray);
  };

  const platformOptions = ['Windows', 'macOS', 'Linux', 'Web', 'iOS', 'Android', 'PlayStation', 'Xbox', 'Nintendo Switch'];
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
        <label className="block text-sm font-medium mb-1.5 text-white/70">Game Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => onBasicUpdate('title', e.target.value)}
          placeholder="Game title"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">Developer</label>
          <input
            type="text"
            value={metadata.developer || ''}
            onChange={(e) => onUpdate('developer', e.target.value)}
            placeholder="Developer name"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">Publisher</label>
          <input
            type="text"
            value={metadata.publisher || ''}
            onChange={(e) => onUpdate('publisher', e.target.value)}
            placeholder="Publisher name"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">Platform</label>
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
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">Genre</label>
          <input
            type="text"
            value={metadata.genre || ''}
            onChange={(e) => onUpdate('genre', e.target.value)}
            placeholder="RPG, FPS, etc."
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">Rating (ESRB)</label>
          <select
            value={metadata.rating || ''}
            onChange={(e) => onUpdate('rating', e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          >
            <option value="">Select rating</option>
            <option value="E">E - Everyone</option>
            <option value="E10+">E10+ - Everyone 10+</option>
            <option value="T">T - Teen</option>
            <option value="M">M - Mature 17+</option>
            <option value="AO">AO - Adults Only</option>
            <option value="RP">RP - Rating Pending</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">Release Year</label>
          <input
            type="number"
            value={metadata.releaseYear || ''}
            onChange={(e) => onUpdate('releaseYear', e.target.value)}
            placeholder="2024"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">Description</label>
        <textarea
          value={description}
          onChange={(e) => onBasicUpdate('description', e.target.value)}
          placeholder="Game description..."
          rows={3}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90 resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">System Requirements</label>
        <textarea
          value={metadata.systemRequirements || ''}
          onChange={(e) => onUpdate('systemRequirements', e.target.value)}
          placeholder="Minimum and recommended specs..."
          rows={3}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90 resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">Screenshots (CIDs)</label>
        <textarea
          value={metadata.screenshots?.join(', ') || ''}
          onChange={(e) => {
            const cids = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
            onUpdate('screenshots', cids);
          }}
          placeholder="Comma-separated CIDs of screenshots"
          rows={2}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90 resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">Tags</label>
        <input
          type="text"
          value={tagsString}
          onChange={(e) => handleTagsChange(e.target.value)}
          placeholder="comma, separated, tags"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>
    </div>
  );
}
