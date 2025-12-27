"use client";

interface Chapter {
  title: string;
  startTime: string;
}

interface AudiobookMetadataFormProps {
  typeMetadata: Record<string, any>;
  onUpdate: (field: string, value: any) => void;
}

export default function AudiobookMetadataForm({
  typeMetadata,
  onUpdate,
}: AudiobookMetadataFormProps) {
  const chapters = typeMetadata.chapters || [];

  const handleAddChapter = () => {
    onUpdate("chapters", [...chapters, { title: "", startTime: "" }]);
  };

  const handleUpdateChapter = (
    index: number,
    field: "title" | "startTime",
    value: string
  ) => {
    const updated = chapters.map((ch: Chapter, i: number) =>
      i === index ? { ...ch, [field]: value } : ch
    );
    onUpdate("chapters", updated);
  };

  const handleRemoveChapter = (index: number) => {
    onUpdate(
      "chapters",
      chapters.filter((_: Chapter, i: number) => i !== index)
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">
          Book Title *
        </label>
        <input
          type="text"
          value={typeMetadata.bookTitle || ""}
          onChange={(e) => onUpdate("bookTitle", e.target.value)}
          placeholder="Full book title"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">
            Author *
          </label>
          <input
            type="text"
            value={typeMetadata.author || ""}
            onChange={(e) => onUpdate("author", e.target.value)}
            placeholder="Author name"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">
            Narrator *
          </label>
          <input
            type="text"
            value={typeMetadata.narrator || ""}
            onChange={(e) => onUpdate("narrator", e.target.value)}
            placeholder="Narrator name"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">
            Publisher
          </label>
          <input
            type="text"
            value={typeMetadata.publisher || ""}
            onChange={(e) => onUpdate("publisher", e.target.value)}
            placeholder="Publisher name"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">
            Genre
          </label>
          <input
            type="text"
            value={typeMetadata.genre || ""}
            onChange={(e) => onUpdate("genre", e.target.value)}
            placeholder="Fiction, Non-Fiction..."
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">
            Language
          </label>
          <input
            type="text"
            value={typeMetadata.language || ""}
            onChange={(e) => onUpdate("language", e.target.value)}
            placeholder="English, Spanish..."
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 text-white/70">
            Release Year
          </label>
          <input
            type="number"
            value={typeMetadata.releaseYear || ""}
            onChange={(e) => onUpdate("releaseYear", parseInt(e.target.value) || "")}
            placeholder="2024"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">
          Total Duration
        </label>
        <input
          type="text"
          value={typeMetadata.totalDuration || ""}
          onChange={(e) => onUpdate("totalDuration", e.target.value)}
          placeholder="e.g., 8h 45m"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">
          Chapters
        </label>
        <div className="space-y-2">
          {chapters.map((chapter: Chapter, index: number) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={chapter.title}
                onChange={(e) =>
                  handleUpdateChapter(index, "title", e.target.value)
                }
                placeholder={`Chapter ${index + 1} title`}
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
              />
              <input
                type="text"
                value={chapter.startTime}
                onChange={(e) =>
                  handleUpdateChapter(index, "startTime", e.target.value)
                }
                placeholder="Start time (e.g., 0:00)"
                className="w-32 px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
              />
              <button
                type="button"
                onClick={() => handleRemoveChapter(index)}
                className="px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors text-white/90"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddChapter}
            className="w-full px-3 py-2 bg-purple-500/20 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-colors text-white/90"
          >
            Add Chapter
          </button>
        </div>
      </div>
    </div>
  );
}
