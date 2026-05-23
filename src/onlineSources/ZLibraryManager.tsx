import type * as React from "react";
import { useEffect, useState } from "react";
import type { ZLibStatus } from "../types";

interface ZLibraryManagerProps {
  sourceId: string;
  baseUrl: string;
  onMirrorChange: (sourceId: string, newUrl: string) => void;
}

type PanelStatus = "loading" | "idle" | "logging-in" | "fetching";

export function ZLibraryManager({ sourceId, baseUrl, onMirrorChange }: ZLibraryManagerProps) {
  const [status, setStatus] = useState<PanelStatus>("loading");
  const [zlib, setZlib] = useState<ZLibStatus>({ loggedIn: false });
  const [mirrorInput, setMirrorInput] = useState(baseUrl);

  const updateZlib = (s: ZLibStatus) => {
    setZlib(s);
    setStatus("idle");
  };

  useEffect(() => {
    window.readerApi.zlibStatus().then((s) => {
      if (s.loggedIn && s.remaining === undefined) {
        setStatus("fetching");
        window.readerApi.zlibFetchAccount().then(updateZlib).catch(() => setStatus("idle"));
      } else {
        updateZlib(s);
      }
    }).catch(() => setStatus("idle"));
  }, []);

  const handleLogin = () => {
    setStatus("logging-in");
    window.readerApi.zlibLogin().then(updateZlib).catch(() => setStatus("idle"));
  };

  const handleLogout = () => {
    window.readerApi.zlibLogout().then(() => {
      setZlib({ loggedIn: false });
      setStatus("idle");
    }).catch(() => undefined);
  };

  const handleRefresh = () => {
    setStatus("fetching");
    window.readerApi.zlibFetchAccount().then(updateZlib).catch(() => setStatus("idle"));
  };

  const handleSaveMirror = () => {
    const url = mirrorInput.trim().replace(/\/$/, "");
    if (!url) return;
    onMirrorChange(sourceId, url);
  };

  const quotaPercent =
    zlib.remaining !== undefined && zlib.dailyLimit
      ? Math.round((zlib.remaining / zlib.dailyLimit) * 100)
      : 0;

  return (
    <div className="zlib-manager-card">
      {/* Account status row */}
      <div className="zlib-status-row">
        <span className={`zlib-status-dot ${zlib.loggedIn ? "on" : "off"}`} />
        <span className="zlib-status-label">
          {status === "loading" ? "查询中…" : zlib.loggedIn ? "已登录" : "未登录"}
        </span>
        {zlib.loggedIn && zlib.email ? (
          <span className="zlib-status-email" title={zlib.email}>{zlib.email}</span>
        ) : !zlib.loggedIn && status === "idle" ? (
          <span className="zlib-status-email">游客 · 每日 5 次</span>
        ) : null}
        {zlib.loggedIn && status === "idle" ? (
          <button className="zlib-refresh-btn" type="button" onClick={handleRefresh}>↻ 刷新</button>
        ) : null}
        {status === "fetching" ? (
          <span className="zlib-status-email">刷新中…</span>
        ) : null}
      </div>

      {/* Quota bar (logged-in only) */}
      {zlib.loggedIn && zlib.remaining !== undefined && zlib.dailyLimit ? (
        <div className="zlib-quota-row">
          <div className="zlib-quota-labels">
            <span>今日下载余量</span>
            <span>{zlib.remaining} / {zlib.dailyLimit} 次</span>
          </div>
          <div className="zlib-quota-bar-track">
            <div className="zlib-quota-bar-fill" style={{ width: `${quotaPercent}%` }} />
          </div>
        </div>
      ) : null}

      <div className="zlib-divider" />

      {/* Login / logout actions */}
      {zlib.loggedIn ? (
        <button
          className="soft-button pressable"
          type="button"
          style={{ color: "var(--reader-danger, #b3261e)", borderColor: "var(--reader-danger, #b3261e)" }}
          onClick={handleLogout}
        >
          退出登录
        </button>
      ) : (
        <>
          <button
            className="soft-button pressable"
            type="button"
            disabled={status === "logging-in" || status === "loading"}
            onClick={handleLogin}
          >
            {status === "logging-in" ? "等待登录窗口…" : "🔑 登录账户"}
          </button>
          <p className="zlib-login-hint">将打开登录窗口，完成后自动关闭</p>
        </>
      )}

      <div className="zlib-divider" />

      {/* Mirror URL */}
      <div className="zlib-mirror-row">
        <p className="zlib-mirror-label">镜像地址</p>
        <div className="zlib-mirror-input-row">
          <input
            className="source-input"
            value={mirrorInput}
            onChange={(e) => setMirrorInput(e.target.value)}
            placeholder="https://zh.z-library.sk"
          />
          <button
            className="soft-button pressable compact-action"
            type="button"
            onClick={handleSaveMirror}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
