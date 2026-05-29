import { Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { useState } from "react";
import { ZLibraryManager } from "./ZLibraryManager";
import type { OnlineSource, OnlineSourceKind, OnlineSourceTestReport } from "../types";

export function OnlineSourceManager({
  sources,
  draftName,
  draftValue,
  draftKind,
  onDraftNameChange,
  onDraftValueChange,
  onDraftKindChange,
  onSourceChange,
  onSourceRemove,
  onSourceAdd,
  sourcePackDraft,
  sourcePackMessage,
  onSourcePackDraftChange,
  onSourcePackImport,
  testQuery,
  testReport,
  testingSourceId,
  onTestQueryChange,
  onSourceTest
}: {
  sources: OnlineSource[];
  draftName: string;
  draftValue: string;
  draftKind: OnlineSourceKind;
  onDraftNameChange: (value: string) => void;
  onDraftValueChange: (value: string) => void;
  onDraftKindChange: (value: OnlineSourceKind) => void;
  onSourceChange: (sourceId: string, patch: Partial<OnlineSource>) => void;
  onSourceRemove: (sourceId: string) => void;
  onSourceAdd: () => void;
  sourcePackDraft: string;
  sourcePackMessage: string;
  onSourcePackDraftChange: (value: string) => void;
  onSourcePackImport: () => void;
  testQuery: string;
  testReport?: OnlineSourceTestReport;
  testingSourceId?: string;
  onTestQueryChange: (value: string) => void;
  onSourceTest: (source: OnlineSource) => void;
}) {
  const [managingZlibSourceId, setManagingZlibSourceId] = useState<string | null>(null);

  const isZlibSource = (source: OnlineSource): boolean => {
    if (source.kind !== "html") return false;
    try {
      const parsed = JSON.parse(source.value) as Record<string, unknown>;
      const searchUrl = typeof parsed.searchUrl === "string" ? parsed.searchUrl : "";
      return searchUrl.includes("z-library") || searchUrl.includes("zlibrary");
    } catch {
      return false;
    }
  };

  const zlibBaseUrl = (source: OnlineSource): string => {
    try {
      const parsed = JSON.parse(source.value) as Record<string, unknown>;
      return typeof parsed.baseUrl === "string" ? parsed.baseUrl : "https://z-library.sk";
    } catch {
      return "https://z-library.sk";
    }
  };

  return (
    <section className="setting-group">
      <h3>Online Sources</h3>
      <div className="online-source-manager">
        <article className="online-source-card source-test-card">
          <div className="online-source-card-head">
            <strong>测试书源解析</strong>
            <span className="online-source-kind">DEBUG</span>
          </div>
          <label className="text-setting compact-text-setting">
            <span>测试关键词</span>
            <input value={testQuery} placeholder="输入关键词" onChange={(event) => onTestQueryChange(event.target.value)} />
          </label>
          {testReport ? <OnlineSourceTestView report={testReport} /> : (
            <p className="source-card-note">点击某个书源卡片里的“测试”按钮，查看 item、详情链接、下载链接和失败原因。</p>
          )}
        </article>
        {sources.map((source) => (
          <React.Fragment key={source.id}>
            <article className="online-source-card">
            <div className="online-source-card-head">
              <strong>{source.kind === "gutenberg" ? "Project Gutenberg" : source.name || "Custom Source"}</strong>
              <div className="online-source-card-actions">
                <span className="online-source-kind">{source.kind}</span>
                {isZlibSource(source) ? (
                  <button
                    className="soft-button pressable compact-action"
                    type="button"
                    onClick={() => setManagingZlibSourceId(
                      managingZlibSourceId === source.id ? null : source.id
                    )}
                  >
                    管理
                  </button>
                ) : null}
                <button
                  className="soft-button pressable compact-action source-test-button"
                  type="button"
                  onClick={() => onSourceTest(source)}
                  disabled={testingSourceId === source.id}
                >
                  {testingSourceId === source.id ? "测试中" : "测试"}
                </button>
                <button
                  className={`toggle-switch ${source.enabled ? "checked" : ""}`}
                  type="button"
                  onClick={() => onSourceChange(source.id, { enabled: !source.enabled })}
                >
                  <i className="toggle-thumb" />
                </button>
                {source.kind !== "gutenberg" ? (
                  <button className="icon-button pressable mini-icon" type="button" onClick={() => onSourceRemove(source.id)} title="Remove source">
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>
            </div>
            {source.kind !== "gutenberg" ? (
              <>
                <label className="text-setting compact-text-setting">
                  <span>Name</span>
                  <input
                    value={source.name}
                    placeholder="My Source"
                    onChange={(event) => onSourceChange(source.id, { name: event.target.value })}
                  />
                </label>
                <label className="text-setting compact-text-setting">
                  <span>Adapter</span>
                  <textarea
                    value={source.value}
                    rows={source.kind === "json" || source.kind === "html" ? 7 : 3}
                    placeholder={
                      source.kind === "json"
                        ? '{ "adapter": "json", "searchUrl": "https://example.com/search?q={query}" }'
                        : source.kind === "html"
                          ? '{ "adapter": "html", "baseUrl": "https://example.com", "searchUrl": "https://example.com/s/{query}", "itemSelector": ".book", "titleSelector": ".title", "coverSelector": "img", "coverAttr": "data-src, src", "detailLinkSelector": "a", "detailLinkAttr": "href", "downloadSelector": "a[href$=\'.epub\']", "downloadAttr": "href", "renderJs": true, "waitForSelector": ".book", "autoScroll": true, "delay": 800, "timeout": 10000 }'
                          : "https://example.com/search?q={query}"
                    }
                    onChange={(event) => onSourceChange(source.id, { value: event.target.value })}
                  />
                </label>
              </>
            ) : (
              <p className="source-card-note">Built-in public-domain test source.</p>
            )}
          </article>
            {managingZlibSourceId === source.id && isZlibSource(source) ? (
              <ZLibraryManager
                sourceId={source.id}
                baseUrl={zlibBaseUrl(source)}
                onMirrorChange={(id, newUrl) => {
                  try {
                    const currentSource = sources.find((s) => s.id === id);
                    const parsed = JSON.parse(currentSource?.value ?? "{}") as Record<string, unknown>;
                    parsed.baseUrl = newUrl;
                    parsed.searchUrl = `${newUrl}/s/{query}`;
                    onSourceChange(id, { value: JSON.stringify(parsed) });
                  } catch {
                    /* ignore parse errors */
                  }
                }}
              />
            ) : null}
          </React.Fragment>
        ))}

        <article className="online-source-card draft">
          <div className="online-source-card-head">
            <strong>Add source</strong>
            <div className="online-source-card-actions">
              <div className="choice-list source-kind-list">
                <button
                  className={draftKind === "url" ? "active" : ""}
                  type="button"
                  onClick={() => onDraftKindChange("url")}
                >
                  URL
                </button>
                <button
                  className={draftKind === "json" ? "active" : ""}
                  type="button"
                  onClick={() => onDraftKindChange("json")}
                >
                  JSON
                </button>
                <button
                  className={draftKind === "html" ? "active" : ""}
                  type="button"
                  onClick={() => onDraftKindChange("html")}
                >
                  HTML
                </button>
                <button
                  className={draftKind === "rss" ? "active" : ""}
                  type="button"
                  onClick={() => onDraftKindChange("rss")}
                >
                  RSS · Atom
                </button>
              </div>
            </div>
          </div>
          <label className="text-setting compact-text-setting">
            <span>Name</span>
            <input
              value={draftName}
              placeholder="My Source"
              onChange={(event) => onDraftNameChange(event.target.value)}
            />
          </label>
          <label className="text-setting compact-text-setting">
            <span>Adapter</span>
            <textarea
              value={draftValue}
              rows={draftKind === "json" || draftKind === "html" ? 7 : 3}
              placeholder={
                draftKind === "json"
                  ? '{ "adapter": "json", "searchUrl": "https://example.com/search?q={query}" }'
                  : draftKind === "html"
                    ? '{ "adapter": "html", "baseUrl": "https://example.com", "searchUrl": "https://example.com/s/{query}", "itemSelector": ".book", "titleSelector": ".title", "coverSelector": "img", "coverAttr": "data-src, src", "detailLinkSelector": "a", "detailLinkAttr": "href", "downloadSelector": "a[href$=\'.epub\']", "downloadAttr": "href", "renderJs": true, "waitForSelector": ".book", "autoScroll": true, "delay": 800, "timeout": 10000 }'
                  : "https://example.com/search?q={query}"
              }
              onChange={(event) => onDraftValueChange(event.target.value)}
            />
          </label>
          <button className="soft-button pressable compact-action" type="button" onClick={onSourceAdd}>
            <Plus size={15} />
            <span>Add source</span>
          </button>
        </article>

        <article className="online-source-card source-pack-card">
          <div className="online-source-card-head">
            <strong>导入书源</strong>
            <span className="online-source-kind">PACK</span>
          </div>
          <p className="source-card-note">
            粘贴一个书源对象、数组，或 <code>{"{ \"sources\": [...] }"}</code>。支持 URL / JSON / HTML 适配器；HTML 可配置
            <code> renderJs</code>、<code>baseUrl</code>、<code>*Attr</code>、<code>waitForSelector</code>、
            <code>autoScroll</code>、<code>delay</code>。
          </p>
          <label className="text-setting compact-text-setting">
            <span>Source pack JSON</span>
            <textarea
              value={sourcePackDraft}
              rows={8}
              placeholder={`{
  "sources": [
    {
      "name": "My HTML Source",
      "kind": "html",
      "enabled": true,
      "value": "{ \\"adapter\\": \\"html\\", \\"baseUrl\\": \\"https://example.com\\", \\"searchUrl\\": \\"https://example.com/search?q={query}\\", \\"itemSelector\\": \\".book\\", \\"titleSelector\\": \\".title\\", \\"detailLinkSelector\\": \\"a\\", \\"downloadSelector\\": \\"a[href$='.epub']\\", \\"renderJs\\": true, \\"waitForSelector\\": \\".book\\", \\"autoScroll\\": true, \\"delay\\": 800 }"
    }
  ]
}`}
              onChange={(event) => onSourcePackDraftChange(event.target.value)}
            />
          </label>
          <button className="soft-button pressable compact-action" type="button" onClick={onSourcePackImport}>
            <Plus size={15} />
            <span>导入书源</span>
          </button>
          {sourcePackMessage ? <p className="source-pack-message">{sourcePackMessage}</p> : null}
        </article>
      </div>
    </section>
  );
}

function OnlineSourceTestView({ report }: { report: OnlineSourceTestReport }) {
  return (
    <div className={`source-test-report ${report.ok ? "ok" : "fail"}`}>
      <div className="source-test-summary">
        <strong>{report.ok ? "可用" : "需要调整"}</strong>
        <span>{report.message}</span>
      </div>
      <dl className="source-test-meta">
        <div>
          <dt>源</dt>
          <dd>{report.sourceName}</dd>
        </div>
        <div>
          <dt>类型</dt>
          <dd>{report.kind}</dd>
        </div>
        <div>
          <dt>已获取</dt>
          <dd>{report.fetched ? "是" : "否"}</dd>
        </div>
        <div>
          <dt>JS</dt>
          <dd>{report.renderedJs ? "开启" : "关闭"}</dd>
        </div>
        <div>
          <dt>匹配项</dt>
          <dd>{report.itemCount}</dd>
        </div>
      </dl>
      {report.searchUrl ? <p className="source-test-url">{report.searchUrl}</p> : null}
      {report.items.length ? (
        <div className="source-test-items">
          {report.items.map((item) => (
            <article key={item.index} className={`source-test-item ${item.ok ? "ok" : "fail"}`}>
              <header>
                <strong>{item.index + 1}. {item.title || "未解析到标题"}</strong>
                <span>{item.ok ? "OK" : "FAIL"}</span>
              </header>
              {item.author ? <p>作者：{item.author}</p> : null}
              {item.detailUrl ? <p>详情：{item.detailUrl}</p> : null}
              {item.downloadUrl ? <p>下载：{item.downloadUrl}</p> : null}
              {item.format ? <p>格式：{item.format}</p> : null}
              {item.reason ? <p className="source-test-reason">原因：{item.reason}</p> : null}
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
