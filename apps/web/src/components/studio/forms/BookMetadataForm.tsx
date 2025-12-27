"use client";

interface BookMetadataFormProps {
  contentType: number;
  metadata: Record<string, any>;
  title: string;
  description: string;
  tags: string[];
  onUpdate: (field: string, value: any) => void;
  onBasicUpdate: (field: string, value: any) => void;
  isEditMode?: boolean;
}

export function BookMetadataForm({
  contentType,
  metadata,
  title,
  description,
  tags,
  onUpdate,
  onBasicUpdate,
  isEditMode = false,
}: BookMetadataFormProps) {
  const tagsString = tags.join(', ');
  const handleTagsChange = (value: string) => {
    const tagArray = value.split(',').map(t => t.trim()).filter(Boolean);
    onBasicUpdate('tags', tagArray);
  };

  // 10 = Book, 11 = Comic
  if (contentType === 11) {
    // Comic
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => onBasicUpdate('title', e.target.value)}
            placeholder="Comic title"
            disabled={isEditMode}
            className={`w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90 ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
          {isEditMode && <p className="text-xs text-amber-400/70 mt-1">Title cannot be changed after publishing</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
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
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">Synopsis</label>
          <textarea
            value={description}
            onChange={(e) => onBasicUpdate('description', e.target.value)}
            placeholder="Issue synopsis..."
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

  // Book (10)
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">Book Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => onBasicUpdate('title', e.target.value)}
          placeholder="Book title"
          disabled={isEditMode}
          className={`w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90 ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        {isEditMode && <p className="text-xs text-amber-400/70 mt-1">Title cannot be changed after publishing</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">Author *</label>
          <input
            type="text"
            value={metadata.author || ''}
            onChange={(e) => onUpdate('author', e.target.value)}
            placeholder="Author name"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">Publisher</label>
          <input
            type="text"
            value={metadata.publisher || ''}
            onChange={(e) => onUpdate('publisher', e.target.value)}
            placeholder="Publisher"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">Description</label>
        <textarea
          value={description}
          onChange={(e) => onBasicUpdate('description', e.target.value)}
          placeholder="Book description..."
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
