import { X } from "lucide-react";

interface KeymapEntry {
  keys: string;
  description: string;
}

const ENTRIES: KeymapEntry[] = [
  { keys: "← →", description: "翻页 / 滚动" },
  { keys: "↑ ↓", description: "上下滚动" },
  { keys: "Ctrl/⌘ + F", description: "搜索" },
  { keys: "I", description: "沉浸模式" },
  { keys: "[  ]", description: "亮度 -5% / +5%" },
  { keys: "+  -", description: "缩放（手动模式）" },
  { keys: "?", description: "显示 / 隐藏此面板" },
  { keys: "Esc", description: "关闭面板 / 搜索" }
];

export function KeymapHint({ onClose }: { onClose: () => void }) {
  return (
    <div className="keymap-hint" role="dialog" aria-label="快捷键">
      <div className="keymap-hint-header">
        <span>快捷键</span>
        <button className="icon-button pressable" onClick={onClose} aria-label="关闭">
          <X size={16} />
        </button>
      </div>
      <ul className="keymap-hint-list">
        {ENTRIES.map((entry) => (
          <li key={entry.keys}>
            <kbd>{entry.keys}</kbd>
            <span>{entry.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
