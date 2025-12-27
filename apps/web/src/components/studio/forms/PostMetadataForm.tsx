"use client";

interface PostMetadataFormProps {
  metadata: Record<string, any>;
  title: string;
  description: string;
  tags: string[];
  onUpdate: (field: string, value: any) => void;
  onBasicUpdate: (field: string, value: any) => void;
  isEditMode?: boolean;
}

export function PostMetadataForm({
  metadata,
  title,
  description,
  tags,
  onUpdate,
  onBasicUpdate,
  isEditMode = false,
}: PostMetadataFormProps) {
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
          placeholder="Post title"
          disabled={isEditMode}
          className={`w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90 ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        {isEditMode && <p className="text-xs text-amber-400/70 mt-1">Title cannot be changed after publishing</p>}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">Author</label>
        <input
          type="text"
          value={metadata.author || ''}
          onChange={(e) => onUpdate('author', e.target.value)}
          placeholder="Your name"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">Excerpt</label>
        <textarea
          value={metadata.excerpt || ''}
          onChange={(e) => onUpdate('excerpt', e.target.value)}
          placeholder="Brief summary or teaser..."
          rows={2}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90 resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">Content</label>
        <textarea
          value={description}
          onChange={(e) => onBasicUpdate('description', e.target.value)}
          placeholder="Full post content..."
          rows={6}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90 resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">Category</label>
        <input
          type="text"
          value={metadata.category || ''}
          onChange={(e) => onUpdate('category', e.target.value)}
          placeholder="Tech, Finance, Art..."
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
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
