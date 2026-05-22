import type * as React from "react";
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import type { BookSourcePreset, OnlineSource } from "../types";
import { BOOK_SOURCE_PRESETS } from "./presets";

function defaultId(): string {
  return `preset-${Date.now()}`;
}

export function PresetsRow({
  currentSources,
  onAdd
}: {
  currentSources: OnlineSource[];
  onAdd: (source: OnlineSource) => void;
}) {
  const [promptId, setPromptId] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState("");

  const isActive = (preset: BookSourcePreset) =>
    currentSources.some((s) => s.id === preset.id || (s.name === preset.name && s.kind === preset.kind));

  const handleChipClick = (preset: BookSourcePreset) => {
    if (isActive(preset)) return;
    if (preset.requiresUserUrl) {
      setPromptId(preset.id);
      setUrlDraft("");
    } else {
      onAdd({
        id: preset.id,
        name: preset.name,
        enabled: true,
        kind: preset.kind,
        value: preset.value
      });
    }
  };

  const confirmUrl = (preset: BookSourcePreset) => {
    if (!urlDraft.trim()) return;
    onAdd({
      id: defaultId(),
      name: preset.name,
      enabled: true,
      kind: preset.kind,
      value: urlDraft.trim()
    });
    setPromptId(null);
    setUrlDraft("");
  };

  return (
    <div className="presets-row">
      <p className="presets-label">预设书源</p>
      <div className="presets-chips">
        {BOOK_SOURCE_PRESETS.map((preset) => {
          const active = isActive(preset);
          return (
            <button
              key={preset.id}
              type="button"
              title={preset.description}
              className={`preset-chip${active ? " active" : ""}`}
              onClick={() => handleChipClick(preset)}
            >
              {active ? <Check size={13} /> : <Plus size={13} />}
              {preset.name}
            </button>
          );
        })}
      </div>
      {promptId && (() => {
        const preset = BOOK_SOURCE_PRESETS.find((p) => p.id === promptId)!;
        return (
          <div className="preset-url-prompt">
            <p className="preset-url-hint">{preset.description} — 请粘贴镜像地址：</p>
            <div className="preset-url-row">
              <input
                className="source-input"
                placeholder="https://..."
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmUrl(preset);
                  if (e.key === "Escape") setPromptId(null);
                }}
                autoFocus
              />
              <button type="button" className="btn-primary small" onClick={() => confirmUrl(preset)}>
                添加
              </button>
              <button type="button" className="btn-ghost small" onClick={() => setPromptId(null)}>
                取消
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
