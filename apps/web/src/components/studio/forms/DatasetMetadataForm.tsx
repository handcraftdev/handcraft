"use client";

interface DatasetMetadataFormProps {
  metadata: Record<string, any>;
  title: string;
  description: string;
  tags: string[];
  onUpdate: (field: string, value: any) => void;
  onBasicUpdate: (field: string, value: any) => void;
}

export function DatasetMetadataForm({
  metadata,
  title,
  description,
  tags,
  onUpdate,
  onBasicUpdate,
}: DatasetMetadataFormProps) {
  const tagsString = tags.join(', ');
  const handleTagsChange = (value: string) => {
    const tagArray = value.split(',').map(t => t.trim()).filter(Boolean);
    onBasicUpdate('tags', tagArray);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Dataset Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => onBasicUpdate('title', e.target.value)}
          placeholder="Dataset name"
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Format</label>
          <select
            value={metadata.format || ''}
            onChange={(e) => onUpdate('format', e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          >
            <option value="">Select format</option>
            <option value="CSV">CSV</option>
            <option value="JSON">JSON</option>
            <option value="Parquet">Parquet</option>
            <option value="Excel">Excel</option>
            <option value="XML">XML</option>
            <option value="HDF5">HDF5</option>
            <option value="SQLite">SQLite</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Row Count</label>
          <input
            type="number"
            value={metadata.rowCount || ''}
            onChange={(e) => onUpdate('rowCount', e.target.value)}
            placeholder="Number of rows"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Column Count</label>
          <input
            type="number"
            value={metadata.columnCount || ''}
            onChange={(e) => onUpdate('columnCount', e.target.value)}
            placeholder="Number of columns"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Source</label>
          <input
            type="text"
            value={metadata.source || ''}
            onChange={(e) => onUpdate('source', e.target.value)}
            placeholder="Data source or origin"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/70">Last Updated</label>
          <input
            type="date"
            value={metadata.lastUpdated || ''}
            onChange={(e) => onUpdate('lastUpdated', e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90"
          />
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
          <option value="CC0">CC0 - Public Domain</option>
          <option value="CC-BY">CC BY - Attribution</option>
          <option value="CC-BY-SA">CC BY-SA - Attribution ShareAlike</option>
          <option value="CC-BY-NC">CC BY-NC - Attribution NonCommercial</option>
          <option value="ODbL">Open Database License (ODbL)</option>
          <option value="ODC-By">ODC Attribution License</option>
          <option value="proprietary">Proprietary</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Description</label>
        <textarea
          value={description}
          onChange={(e) => onBasicUpdate('description', e.target.value)}
          placeholder="Dataset description and use cases..."
          rows={3}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90 resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Schema</label>
        <textarea
          value={metadata.schema || ''}
          onChange={(e) => onUpdate('schema', e.target.value)}
          placeholder="Column definitions and data types..."
          rows={4}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90 resize-none font-mono text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-white/70">Sample Preview</label>
        <textarea
          value={metadata.samplePreview || ''}
          onChange={(e) => onUpdate('samplePreview', e.target.value)}
          placeholder="Sample data rows or example entries..."
          rows={4}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white/90 resize-none font-mono text-sm"
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
