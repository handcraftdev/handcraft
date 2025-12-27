"use client";

interface ComicMetadataFormProps {
  metadata: Record<string, any>;
  title: string;
  description: string;
  tags: string[];
  onUpdate: (field: string, value: any) => void;
  onBasicUpdate: (field: string, value: any) => void;
}

export function ComicMetadataForm({
  metadata,
  title,
  description,
  tags,
  onUpdate,
  onBasicUpdate,
}: ComicMetadataFormProps) {
  const tagsString = tags.join(', ');
  const handleTagsChange = (value: string) => {
    const tagArray = value.split(',').map(t => t.trim()).filter(Boolean);
    onBasicUpdate('tags', tagArray);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => onBasicUpdate('title', e.target.value)}
          placeholder="Comic title"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">Series</label>
          <input
            type="text"
            value={metadata.series || ''}
            onChange={(e) => onUpdate('series', e.target.value)}
            placeholder="Series name"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">Issue Number</label>
          <input
            type="text"
            value={metadata.issueNumber || ''}
            onChange={(e) => onUpdate('issueNumber', e.target.value)}
            placeholder="e.g., #1"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">Writer</label>
          <input
            type="text"
            value={metadata.writer || ''}
            onChange={(e) => onUpdate('writer', e.target.value)}
            placeholder="Writer name"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">Artist</label>
          <input
            type="text"
            value={metadata.artist || ''}
            onChange={(e) => onUpdate('artist', e.target.value)}
            placeholder="Artist name"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">Colorist</label>
          <input
            type="text"
            value={metadata.colorist || ''}
            onChange={(e) => onUpdate('colorist', e.target.value)}
            placeholder="Colorist name"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
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
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">Page Count</label>
          <input
            type="number"
            value={metadata.pageCount || ''}
            onChange={(e) => onUpdate('pageCount', e.target.value)}
            placeholder="Number of pages"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">Reading Direction</label>
          <select
            value={metadata.readingDirection || 'LTR'}
            onChange={(e) => onUpdate('readingDirection', e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          >
            <option value="LTR">Left to Right</option>
            <option value="RTL">Right to Left</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">Genre</label>
          <input
            type="text"
            value={metadata.genre || ''}
            onChange={(e) => onUpdate('genre', e.target.value)}
            placeholder="Superhero, Manga, etc."
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">Synopsis</label>
        <textarea
          value={description}
          onChange={(e) => onBasicUpdate('description', e.target.value)}
          placeholder="Issue synopsis..."
          rows={3}
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
