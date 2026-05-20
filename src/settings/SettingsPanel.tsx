import { ChevronRight, Plus, Trash2 } from "lucide-react";
import type * as React from "react";
import { useState } from "react";
import { SegmentedControl } from "../components/SegmentedControl";
import { createTranslator, type TranslationKey } from "../i18n";
import { readerFontStack } from "../reader/utils";
import { themeOptions } from "../themes";
import type {
  OnlineSource,
  OnlineSourceKind,
  OnlineSourceTestReport,
  ReaderFontFamily,
  ReaderPreferences,
  ThemeCustomColors
} from "../types";

const fontFamilyOptions: Array<{ id: ReaderFontFamily; label: TranslationKey }> = [
  { id: "serif-cn", label: "fontSerifCn" },
  { id: "sans", label: "fontSans" },
  { id: "kai", label: "fontKai" },
  { id: "jp-serif", label: "fontJpSerif" },
  { id: "serif-en", label: "fontSerifEn" },
  { id: "custom", label: "fontCustom" }
];

function defaultCustomSource(index: number): OnlineSource {
  return {
    id: `custom-${Date.now()}-${index}`,
    name: `Custom Source ${index + 1}`,
    enabled: true,
    kind: "url",
    value: ""
  };
}

function parseSourcePack(text: string): OnlineSource[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed) as unknown;
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { sources?: unknown }).sources)
      ? ((parsed as { sources: unknown[] }).sources)
      : [parsed];

  return list
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return undefined;
      const source = entry as Partial<OnlineSource>;
      if (!source.name || !source.kind || !["url", "json", "html", "gutenberg"].includes(source.kind)) {
        return undefined;
      }
      return {
        id: source.id || `imported-${Date.now()}-${index}`,
        name: source.name,
        enabled: source.enabled ?? true,
        kind: source.kind,
        value: source.value || ""
      } satisfies OnlineSource;
    })
    .filter((source): source is OnlineSource => Boolean(source));
}
export function SettingsPanel({
  open,
  preferences,
  t,
  onClose,
  onChange
}: {
  open: boolean;
  preferences: ReaderPreferences;
  t: ReturnType<typeof createTranslator>;
  onClose: () => void;
  onChange: (preferences: Partial<ReaderPreferences>) => void;
}) {
  const updateCustomColor = (key: keyof ThemeCustomColors, value: string) => {
    onChange({
      themeSource: "custom",
      customColors: {
        ...preferences.customColors,
        [key]: value
      }
    });
  };
  const [draftSourceName, setDraftSourceName] = useState("");
  const [draftSourceValue, setDraftSourceValue] = useState("");
  const [draftSourceKind, setDraftSourceKind] = useState<OnlineSourceKind>("url");
  const [sourcePackDraft, setSourcePackDraft] = useState("");
  const [sourcePackMessage, setSourcePackMessage] = useState("");
  const [sourceTestQuery, setSourceTestQuery] = useState("村上春树");
  const [sourceTestReport, setSourceTestReport] = useState<OnlineSourceTestReport | undefined>();
  const [sourceTestLoadingId, setSourceTestLoadingId] = useState<string | undefined>();

  const updateSource = (sourceId: string, patch: Partial<OnlineSource>) => {
    onChange({
      onlineSources: preferences.onlineSources.map((source) =>
        source.id === sourceId ? { ...source, ...patch } : source
      )
    });
  };

  const removeSource = (sourceId: string) => {
    onChange({
      onlineSources: preferences.onlineSources.filter(
        (source) => source.id !== sourceId || source.kind === "gutenberg"
      )
    });
  };

  const addSource = () => {
    if (!draftSourceValue.trim()) {
      return;
    }

    const nextSource: OnlineSource = {
      ...defaultCustomSource(preferences.onlineSources.length),
      name: draftSourceName.trim() || `Custom Source ${preferences.onlineSources.length}`,
      kind: draftSourceKind,
      value: draftSourceValue.trim()
    };

    onChange({
      onlineSources: [...preferences.onlineSources, nextSource]
    });
    setDraftSourceName("");
    setDraftSourceValue("");
    setDraftSourceKind("url");
  };

  const importSourcePack = () => {
    try {
      const importedSources = parseSourcePack(sourcePackDraft);
      if (!importedSources.length) {
        setSourcePackMessage("没有识别到可导入的书源。");
        return;
      }

      const existingKeys = new Set(
        preferences.onlineSources.map((source) => `${source.kind}:${source.name}:${source.value}`)
      );
      const dedupedSources = importedSources.filter((source) => {
        const key = `${source.kind}:${source.name}:${source.value}`;
        if (existingKeys.has(key)) {
          return false;
        }
        existingKeys.add(key);
        return true;
      });

      if (!dedupedSources.length) {
        setSourcePackMessage("这些书源已经存在。");
        return;
      }

      onChange({
        onlineSources: [...preferences.onlineSources, ...dedupedSources]
      });
      setSourcePackDraft("");
      setSourcePackMessage(`已导入 ${dedupedSources.length} 个书源。`);
    } catch {
      setSourcePackMessage("JSON 格式不正确，请检查逗号、引号和括号。");
    }
  };

  const testSource = async (source: OnlineSource) => {
    setSourceTestLoadingId(source.id);
    setSourceTestReport(undefined);
    try {
      const report = await Promise.race([
        window.readerApi.testOnlineSource(sourceTestQuery || "test", source),
        new Promise<OnlineSourceTestReport>((resolve) =>
          window.setTimeout(
            () =>
              resolve({
                ok: false,
                sourceName: source.name,
                kind: source.kind,
                fetched: false,
                renderedJs: source.value.includes('"renderJs": true') || source.value.includes('"renderJs":true'),
                itemCount: 0,
                items: [],
                message: "测试超时：页面加载或详情页解析太慢。可降低 timeout/delay/maxPages，或关闭 renderJs 再试。"
              }),
            45000
          )
        )
      ]);
      setSourceTestReport(report);
    } finally {
      setSourceTestLoadingId(undefined);
    }
  };

  return (
    <>
      <button
        className={`settings-scrim ${open ? "open" : ""}`}
        type="button"
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        onClick={onClose}
      />
      <aside className={`settings-panel ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">{t("appearance")}</p>
          <h2>{t("settings")}</h2>
        </div>
        <button className="icon-button pressable" onClick={onClose} aria-label={t("back")}>
          <ChevronRight size={19} />
        </button>
      </div>

      <SettingSection label="外观" />

      {/* Apple 风格阅读器纸色预设 */}
      <SettingGroup label="阅读纸色">
        <div className="reader-preset-row">
          {(["default", "paper", "quiet", "gray", "night"] as const).map((preset) => {
            const colors: Record<string, { bg: string; label: string }> = {
              default: { bg: "var(--reader-bg)", label: "默认" },
              paper:   { bg: "#fbf0d9", label: "纸黄" },
              quiet:   { bg: "#f7f4ee", label: "米白" },
              gray:    { bg: "#2b2b2b", label: "夜灰" },
              night:   { bg: "#000000", label: "极夜" },
            };
            const { bg, label } = colors[preset];
            return (
              <button
                key={preset}
                className={`reader-preset-dot ${preferences.readerColorPreset === preset ? "active" : ""}`}
                style={{ background: bg }}
                title={label}
                onClick={() => onChange({ readerColorPreset: preset })}
                aria-label={label}
              />
            );
          })}
        </div>
      </SettingGroup>

      <SettingGroup label="阅读亮度">
        <RangeSetting
          label="亮度"
          value={Math.round(preferences.brightness * 100)}
          min={40}
          max={100}
          unit="%"
          onChange={(v) => onChange({ brightness: v / 100 })}
        />
      </SettingGroup>

      <SettingGroup label={t("themeMode")}>
        <SegmentedControl
          value={preferences.themeMode}
          options={[
            ["system", t("modeSystem")],
            ["light", t("modeLight")],
            ["dark", t("modeDark")]
          ]}
          onChange={(themeMode) => onChange({ themeMode: themeMode as ReaderPreferences["themeMode"] })}
        />
      </SettingGroup>

      <SettingGroup label={t("themeSource")}>
        <SegmentedControl
          value={preferences.themeSource}
          options={[
            ["preset", t("sourcePreset")],
            ["seed", t("sourceSeed")],
            ["custom", t("sourceCustom")]
          ]}
          onChange={(themeSource) => onChange({ themeSource: themeSource as ReaderPreferences["themeSource"] })}
        />
      </SettingGroup>

      <SettingGroup label={t("theme")}>
        <div className="theme-grid">
          {themeOptions.map((theme) => (
            <button
              key={theme.id}
              className={`theme-option ${preferences.theme === theme.id ? "active" : ""}`}
              onClick={() =>
                onChange({
                  theme: theme.id,
                  themeSource: "preset",
                  themeSeedColor: theme.seed
                })
              }
            >
              <span>
                {theme.swatches.map((swatch) => (
                  <i key={swatch} style={{ background: swatch }} />
                ))}
              </span>
              {t(theme.id)}
            </button>
          ))}
        </div>
      </SettingGroup>

      <SettingGroup label={t("seedColor")}>
        <ColorSetting
          label={t("seedColor")}
          value={preferences.themeSeedColor}
          onChange={(themeSeedColor) => onChange({ themeSource: "seed", themeSeedColor })}
        />
      </SettingGroup>

      <SettingGroup label={t("customColors")}>
        <ColorSetting
          label={t("primaryColor")}
          value={preferences.customColors.primary}
          onChange={(value) => updateCustomColor("primary", value)}
        />
        <ColorSetting
          label={t("secondaryColor")}
          value={preferences.customColors.secondary}
          onChange={(value) => updateCustomColor("secondary", value)}
        />
        <ColorSetting
          label={t("tertiaryColor")}
          value={preferences.customColors.tertiary}
          onChange={(value) => updateCustomColor("tertiary", value)}
        />
        <ColorSetting
          label={t("surfaceColor")}
          value={preferences.customColors.surface}
          onChange={(value) => updateCustomColor("surface", value)}
        />
      </SettingGroup>

      <SettingGroup label={t("language")}>
        <SegmentedControl
          value={preferences.language}
          options={[
            ["zh-CN", t("zh")],
            ["ja-JP", t("ja")],
            ["en-US", t("en")]
          ]}
          onChange={(language) => onChange({ language: language as ReaderPreferences["language"] })}
        />
      </SettingGroup>

      <SettingGroup label={t("motion")}>
        <SegmentedControl
          value={preferences.motion}
          options={[
            ["full", t("fullMotion")],
            ["gentle", t("gentleMotion")],
            ["reduced", t("reducedMotion")]
          ]}
          onChange={(motion) =>
            onChange({
              motion: motion as ReaderPreferences["motion"],
              reduceMotion: motion === "reduced"
            })
          }
        />
      </SettingGroup>

      <SettingSection label="翻页" />

      <SettingGroup label={t("readerMode")}>
        <SegmentedControl
          value={preferences.readerMode}
          options={[
            ["scroll", t("scroll")],
            ["paged", t("paged")]
          ]}
          onChange={(readerMode) => onChange({ readerMode: readerMode as ReaderPreferences["readerMode"] })}
        />
      </SettingGroup>

      <TextSetting
        label="在线书源 JSON 端点"
        value=""
        placeholder="https://example.com/search?q={query}"
        onChange={() => undefined}
      />

      <CodeTextSetting
        label="Online source adapter"
        value=""
        placeholder={`https://example.com/search?q={query}\nor paste a JSON adapter config`}
        help={
          `URL mode:\nhttps://example.com/search?q={query}\n\nJSON mode:\n{\n  "adapter": "json",\n  "sourceName": "My Source",\n  "searchUrl": "https://example.com/api/search?keyword={query}",\n  "resultPath": "data.items",\n  "headers": { "Authorization": "Bearer token" },\n  "mappings": {\n    "id": "id",\n    "title": "title",\n    "author": "author.name",\n    "downloadUrl": "links.epub",\n    "format": "format",\n    "coverUrl": "cover"\n  }\n}`
        }
        onChange={() => undefined}
      />

      <SettingSection label="网络" />

      <OnlineSourceManager
        sources={preferences.onlineSources}
        draftName={draftSourceName}
        draftValue={draftSourceValue}
        draftKind={draftSourceKind}
        onDraftNameChange={setDraftSourceName}
        onDraftValueChange={setDraftSourceValue}
        onDraftKindChange={setDraftSourceKind}
        onSourceChange={updateSource}
        onSourceRemove={removeSource}
        onSourceAdd={addSource}
        sourcePackDraft={sourcePackDraft}
        sourcePackMessage={sourcePackMessage}
        onSourcePackDraftChange={(value) => {
          setSourcePackDraft(value);
          setSourcePackMessage("");
        }}
        onSourcePackImport={importSourcePack}
        testQuery={sourceTestQuery}
        testReport={sourceTestReport}
        testingSourceId={sourceTestLoadingId}
        onTestQueryChange={setSourceTestQuery}
        onSourceTest={testSource}
      />

      <SettingSection label="排版" />

      <SettingGroup label={t("fontFamily")}>
        <ChoiceList
          value={preferences.fontFamily}
          options={fontFamilyOptions.map((option): [string, string] => [option.id, t(option.label)])}
          onChange={(fontFamily) => onChange({ fontFamily: fontFamily as ReaderFontFamily })}
        />
        <p className="font-preview" style={{ fontFamily: readerFontStack(preferences) }}>
          {t("fontPreview")}
        </p>
      </SettingGroup>

      <TextSetting
        label={t("customFont")}
        value={preferences.customFontStack}
        placeholder="Yu Mincho, MS Mincho, SimSun"
        onChange={(customFontStack) => onChange({ fontFamily: "custom", customFontStack })}
      />

      <RangeSetting
        label={t("fontSize")}
        value={preferences.fontSize}
        min={14}
        max={28}
        unit="px"
        onChange={(fontSize) => onChange({ fontSize })}
      />
      <RangeSetting
        label={t("lineHeight")}
        value={preferences.lineHeight}
        min={1.35}
        max={2.2}
        step={0.05}
        onChange={(lineHeight) => onChange({ lineHeight })}
      />
      <RangeSetting
        label={t("columnWidth")}
        value={preferences.columnWidth}
        min={560}
        max={980}
        step={20}
        unit="px"
        onChange={(columnWidth) => onChange({ columnWidth })}
      />
      <SettingGroup label="页边距">
        <SegmentedControl
          value={preferences.pageMargin}
          options={[
            ["narrow", "紧凑"],
            ["normal", "标准"],
            ["wide", "宽松"]
          ]}
          onChange={(pageMargin) => onChange({ pageMargin: pageMargin as ReaderPreferences["pageMargin"] })}
        />
      </SettingGroup>

      <SettingGroup label="排版">
        <ToggleSetting
          label="两端对齐"
          checked={preferences.justify}
          onChange={(justify) => onChange({ justify })}
        />
        <ToggleSetting
          label="自动断词"
          checked={preferences.hyphenate}
          onChange={(hyphenate) => onChange({ hyphenate })}
        />
      </SettingGroup>

      <RangeSetting
        label={t("imageScale")}
        value={preferences.imageScale}
        min={50}
        max={140}
        step={2}
        unit="%"
        disabled={preferences.imageMode === "fit-screen"}
        onChange={(imageScale) => onChange({ imageScale })}
      />
      <ToggleSetting
        label={t("fitScreen")}
        checked={preferences.imageMode === "fit-screen"}
        onChange={(checked) => onChange({ imageMode: checked ? "fit-screen" : "manual" })}
      />
      <ToggleSetting
        label={t("autoAlign")}
        checked={preferences.autoAlign}
        onChange={(autoAlign) => onChange({ autoAlign })}
      />
      </aside>
    </>
  );
}

function SettingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="setting-group">
      <h3>{label}</h3>
      {children}
    </section>
  );
}

function SettingSection({ label }: { label: string }) {
  return <p className="settings-section-label">{label}</p>;
}

function OnlineSourceManager({
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
          <article key={source.id} className="online-source-card">
            <div className="online-source-card-head">
              <strong>{source.kind === "gutenberg" ? "Project Gutenberg" : source.name || "Custom Source"}</strong>
              <div className="online-source-card-actions">
                <span className="online-source-kind">{source.kind}</span>
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

function ChoiceList({
  value,
  options,
  onChange
}: {
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="choice-list">
      {options.map(([optionValue, label]) => (
        <button
          key={optionValue}
          className={optionValue === value ? "active" : ""}
          type="button"
          onClick={() => onChange(optionValue)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ToggleSetting({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="toggle-setting">
      <span>{label}</span>
      <button
        className={`toggle-switch ${checked ? "checked" : ""}`}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
      >
        <i className="toggle-thumb" />
      </button>
    </div>
  );
}

function TextSetting({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  if (placeholder === "https://example.com/search?q={query}") {
    return null;
  }

  return (
    <label className="text-setting">
      <span>{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function CodeTextSetting({
  label,
  value,
  placeholder,
  help,
  onChange
}: {
  label: string;
  value: string;
  placeholder?: string;
  help?: string;
  onChange: (value: string) => void;
}) {
  if (label === "Online source adapter") {
    return null;
  }

  return (
    <label className="text-setting code-text-setting">
      <span>{label}</span>
      <textarea
        value={value}
        placeholder={placeholder}
        rows={10}
        onChange={(event) => onChange(event.target.value)}
      />
      {help ? <pre className="source-config-help">{help}</pre> : null}
    </label>
  );
}

function ColorSetting({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="color-setting">
      <span>{label}</span>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function RangeSetting({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  disabled = false,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className={`range-setting ${disabled ? "disabled" : ""}`}>
      <span>
        {label}
        <strong>
          {value}
          {unit}
        </strong>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

