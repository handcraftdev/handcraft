"use client";

import { useState } from "react";

interface Timestamp {
  label: string;
  time: string;
}

interface PodcastMetadataFormProps {
  typeMetadata: Record<string, any>;
  onUpdate: (field: string, value: any) => void;
}

export default function PodcastMetadataForm({
  typeMetadata,
  onUpdate,
}: PodcastMetadataFormProps) {
  const [hostInput, setHostInput] = useState("");
  const [guestInput, setGuestInput] = useState("");

  const hostNames = typeMetadata.hostNames || [];
  const guestNames = typeMetadata.guestNames || [];
  const timestamps = typeMetadata.timestamps || [];

  const handleAddHost = () => {
    if (hostInput.trim()) {
      onUpdate("hostNames", [...hostNames, hostInput.trim()]);
      setHostInput("");
    }
  };

  const handleRemoveHost = (index: number) => {
    onUpdate(
      "hostNames",
      hostNames.filter((_: string, i: number) => i !== index)
    );
  };

  const handleAddGuest = () => {
    if (guestInput.trim()) {
      onUpdate("guestNames", [...guestNames, guestInput.trim()]);
      setGuestInput("");
    }
  };

  const handleRemoveGuest = (index: number) => {
    onUpdate(
      "guestNames",
      guestNames.filter((_: string, i: number) => i !== index)
    );
  };

  const handleAddTimestamp = () => {
    onUpdate("timestamps", [...timestamps, { label: "", time: "" }]);
  };

  const handleUpdateTimestamp = (
    index: number,
    field: "label" | "time",
    value: string
  ) => {
    const updated = timestamps.map((ts: Timestamp, i: number) =>
      i === index ? { ...ts, [field]: value } : ts
    );
    onUpdate("timestamps", updated);
  };

  const handleRemoveTimestamp = (index: number) => {
    onUpdate(
      "timestamps",
      timestamps.filter((_: Timestamp, i: number) => i !== index)
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">
          Show Name *
        </label>
        <input
          type="text"
          value={typeMetadata.showName || ""}
          onChange={(e) => onUpdate("showName", e.target.value)}
          placeholder="Podcast show name"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">
          Episode Number
        </label>
        <input
          type="number"
          value={typeMetadata.episodeNumber || ""}
          onChange={(e) => onUpdate("episodeNumber", parseInt(e.target.value) || "")}
          placeholder="Episode number"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">
          Host Names
        </label>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={hostInput}
              onChange={(e) => setHostInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAddHost()}
              placeholder="Add host name"
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
            />
            <button
              type="button"
              onClick={handleAddHost}
              className="px-3 py-2 bg-purple-500/20 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-colors text-white/90"
            >
              Add
            </button>
          </div>
          {hostNames.length > 0 && (
            <div className="space-y-2">
              {hostNames.map((host: string, index: number) => (
                <div
                  key={index}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg"
                >
                  <span className="flex-1 text-white/90">{host}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveHost(index)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">
          Guest Names
        </label>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={guestInput}
              onChange={(e) => setGuestInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAddGuest()}
              placeholder="Add guest name"
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
            />
            <button
              type="button"
              onClick={handleAddGuest}
              className="px-3 py-2 bg-purple-500/20 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-colors text-white/90"
            >
              Add
            </button>
          </div>
          {guestNames.length > 0 && (
            <div className="space-y-2">
              {guestNames.map((guest: string, index: number) => (
                <div
                  key={index}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg"
                >
                  <span className="flex-1 text-white/90">{guest}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveGuest(index)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">
          Timestamps
        </label>
        <div className="space-y-2">
          {timestamps.map((ts: Timestamp, index: number) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={ts.label}
                onChange={(e) =>
                  handleUpdateTimestamp(index, "label", e.target.value)
                }
                placeholder="Label (e.g., Intro, Discussion)"
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
              />
              <input
                type="text"
                value={ts.time}
                onChange={(e) =>
                  handleUpdateTimestamp(index, "time", e.target.value)
                }
                placeholder="Time (e.g., 1:23)"
                className="w-24 px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90"
              />
              <button
                type="button"
                onClick={() => handleRemoveTimestamp(index)}
                className="px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors text-white/90"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddTimestamp}
            className="w-full px-3 py-2 bg-purple-500/20 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-colors text-white/90"
          >
            Add Timestamp
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-white/70">
          Show Notes
        </label>
        <textarea
          value={typeMetadata.showNotes || ""}
          onChange={(e) => onUpdate("showNotes", e.target.value)}
          placeholder="Detailed episode notes, links, resources..."
          rows={6}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500/50 text-white/90 resize-none"
        />
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-white/70 cursor-pointer">
          <input
            type="checkbox"
            checked={typeMetadata.explicit || false}
            onChange={(e) => onUpdate("explicit", e.target.checked)}
            className="w-4 h-4 rounded border-white/10 bg-white/5 checked:bg-purple-500"
          />
          Explicit Content
        </label>
      </div>
    </div>
  );
}
