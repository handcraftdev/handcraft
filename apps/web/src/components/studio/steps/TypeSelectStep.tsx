"use client";

import { ContentDraft } from '@/lib/supabase';

interface TypeSelectStepProps {
  draft: ContentDraft | null;
  onUpdate: (updates: Partial<ContentDraft>) => void;
  onNext: () => void;
}

const DOMAINS = [
  { key: 'video', label: 'Video', icon: '🎬', description: 'Movies, shows, clips' },
  { key: 'audio', label: 'Audio', icon: '🎵', description: 'Music, podcasts, audiobooks' },
  { key: 'image', label: 'Image', icon: '🖼️', description: 'Photos, artwork' },
  { key: 'document', label: 'Document', icon: '📚', description: 'Books, comics, PDFs' },
  { key: 'file', label: 'File', icon: '📦', description: 'Assets, software, games' },
  { key: 'text', label: 'Text', icon: '📝', description: 'Posts, articles' },
];

const CONTENT_TYPES: Record<string, Array<{ type: number; label: string; description: string }>> = {
  video: [
    { type: 0, label: 'Video', description: 'General video content' },
    { type: 1, label: 'Movie', description: 'Feature films, documentaries' },
    { type: 2, label: 'Television', description: 'TV episodes, series' },
    { type: 3, label: 'Music Video', description: 'Music videos, performances' },
    { type: 4, label: 'Short', description: 'Clips, shorts, reels' },
  ],
  audio: [
    { type: 5, label: 'Music', description: 'Songs, tracks, albums' },
    { type: 6, label: 'Podcast', description: 'Podcast episodes' },
    { type: 7, label: 'Audiobook', description: 'Audiobooks, chapters' },
  ],
  image: [
    { type: 8, label: 'Photo', description: 'Photography' },
    { type: 9, label: 'Artwork', description: 'Digital art, illustrations' },
  ],
  document: [
    { type: 10, label: 'Book', description: 'Ebooks, documents' },
    { type: 11, label: 'Comic', description: 'Comics, manga' },
  ],
  file: [
    { type: 12, label: 'Asset', description: 'Templates, resources' },
    { type: 13, label: 'Game', description: 'Games, interactive' },
    { type: 14, label: 'Software', description: 'Apps, plugins, tools' },
    { type: 15, label: 'Dataset', description: 'Data files, CSVs' },
  ],
  text: [
    { type: 16, label: 'Post', description: 'Blog posts, articles' },
  ],
};

export function TypeSelectStep({ draft, onUpdate, onNext }: TypeSelectStepProps) {
  const selectedDomain = draft?.domain;
  const selectedType = draft?.content_type;

  const handleDomainSelect = (domain: string) => {
    const types = CONTENT_TYPES[domain];
    onUpdate({
      domain,
      content_type: types.length === 1 ? types[0].type : undefined
    });
    if (types.length === 1) {
      onNext();
    }
  };

  const handleTypeSelect = (type: number) => {
    onUpdate({ content_type: type });
    onNext();
  };

  if (!selectedDomain) {
    return (
      <div className="max-w-3xl mx-auto">
        <h2 className="text-lg font-medium text-white/90 mb-1">What are you uploading?</h2>
        <p className="text-sm text-white/40 mb-6">Choose the type of content you want to publish</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {DOMAINS.map((domain) => (
            <button
              key={domain.key}
              onClick={() => handleDomainSelect(domain.key)}
              className="relative p-4 rounded-lg border border-white/10 hover:border-purple-500/30 bg-white/[0.02] hover:bg-white/5 transition-all duration-200 text-left group overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-transparent group-hover:from-purple-500/5 transition-all duration-200" />
              <div className="relative">
                <div className="text-xl mb-2">{domain.icon}</div>
                <p className="font-medium text-base text-white/90 mb-0.5">{domain.label}</p>
                <p className="text-sm text-white/40">{domain.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const types = CONTENT_TYPES[selectedDomain] || [];

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => onUpdate({ domain: '', content_type: undefined })}
        className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to domains
      </button>

      <h2 className="text-lg font-medium text-white/90 mb-1">
        What type of {selectedDomain}?
      </h2>
      <p className="text-sm text-white/40 mb-5">Select the specific type</p>

      <div className="space-y-2">
        {types.map((type) => (
          <button
            key={type.type}
            onClick={() => handleTypeSelect(type.type)}
            className={`relative w-full p-3 rounded-lg border transition-all duration-200 text-left group flex items-center gap-3 overflow-hidden ${
              selectedType === type.type
                ? 'border-purple-500/50 bg-purple-500/10'
                : 'border-white/10 hover:border-purple-500/30 bg-white/[0.02] hover:bg-white/5'
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-transparent group-hover:from-purple-500/5 transition-all duration-200" />
            <div className="relative flex-1">
              <p className="font-medium text-sm text-white/90 mb-0.5">{type.label}</p>
              <p className="text-sm text-white/40">{type.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
