import { ChevronRight } from "lucide-react";
import * as React from "react";
import { useState } from "react";
import { SegmentedControl } from "../components/SegmentedControl";
import { createTranslator, type TranslationKey } from "../i18n";
import { PresetsRow } from "../onlineSources/PresetsRow";
import { OnlineSourceManager } from "../onlineSources/OnlineSourceManager";
import { readerFontStack } from "../reader/utils";
import { themeOptions } from "../themes";
import { defaultCustomSource, parseSourcePack } from "./sourcePack";
import { ChoiceList, CodeTextSetting, ColorSetting, RangeSetting, TextSetting, ToggleSetting } from "./SettingsControls";
import type {
  OnlineSource,
  OnlineSourceKind,
  OnlineSourceTestReport,
  ReaderFontFamily,
  ReaderPreferences,
  ThemeCustomColors,
  WellnessPreferences
} from "../types";

const defaultWellness: WellnessPreferences = {
  pomodoroEnabled: true,
  pomodoroMinutes: 25,
  eveningModeEnabled: true,
  eveningModeStart: "20:00",
  eveningModeEnd: "06:00",
  showDailySummary: true,
};

const fontFamilyOptions: Array<{ id: ReaderFontFamily; label: TranslationKey }> = [
  { id: "serif-cn", label: "fontSerifCn" },
  { id: "anthropic-sans", label: "fontAnthropicSans" },
  { id: "sans", label: "fontSans" },
  { id: "kai", label: "fontKai" },
  { id: "jp-serif", label: "fontJpSerif" },
  { id: "serif-en", label: "fontSerifEn" },
  { id: "custom", label: "fontCustom" }
];

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

      <SettingGroup label="翻页动效">
        <SegmentedControl
          value={preferences.pageTurnStyle ?? "slide"}
          options={[["slide", "滑动"], ["fade", "淡入"], ["curl", "卷曲"], ["none", "无"]]}
          onChange={(v) => onChange({ pageTurnStyle: v as ReaderPreferences["pageTurnStyle"] })}
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

      <PresetsRow
        currentSources={preferences.onlineSources}
        onAdd={(source) => {
          onChange({
            onlineSources: [...preferences.onlineSources, source]
          });
        }}
      />

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
        <ToggleSetting
          label="首字下沉"
          checked={preferences.dropCap ?? true}
          onChange={(dropCap) => onChange({ dropCap })}
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

      <SettingGroup label="漫画 / PDF 适配">
        <SegmentedControl
          value={preferences.comicFit}
          options={[
            ["width", "宽"],
            ["height", "高"],
            ["page", "页"],
            ["original", "原"],
            ["manual", "手动"]
          ]}
          onChange={(comicFit) => onChange({ comicFit: comicFit as ReaderPreferences["comicFit"] })}
        />
      </SettingGroup>
      <SettingGroup label="漫画布局">
        <SegmentedControl
          value={preferences.comicLayout}
          options={[
            ["single", "单页"],
            ["double", "双页"],
            ["webtoon", "条漫"]
          ]}
          onChange={(comicLayout) => onChange({ comicLayout: comicLayout as ReaderPreferences["comicLayout"] })}
        />
        <ToggleSetting
          label="按键翻页后自动对齐到下一页"
          checked={preferences.mangaSnapToPage}
          onChange={(mangaSnapToPage) => onChange({ mangaSnapToPage })}
        />
      </SettingGroup>
      <SettingGroup label="阅读方向">
        <SegmentedControl
          value={preferences.readingDirection}
          options={[
            ["ltr", "从左到右"],
            ["rtl", "从右到左（日漫）"]
          ]}
          onChange={(readingDirection) =>
            onChange({ readingDirection: readingDirection as ReaderPreferences["readingDirection"] })
          }
        />
      </SettingGroup>
      <ToggleSetting
        label="首页单独占位（双页对齐封面）"
        checked={preferences.comicCoverSolo}
        onChange={(comicCoverSolo) => onChange({ comicCoverSolo })}
      />
      <ToggleSetting
        label="沉浸模式（隐藏所有界面）"
        checked={preferences.immersive}
        onChange={(immersive) => onChange({ immersive })}
      />

      <SettingSection label={t("dailyGoal")} />

      <SettingGroup label={t("dailyGoal")}>
        <div className="setting-row">
          <label className="setting-label">{t("dailyGoal")}</label>
          <div className="setting-control">
            <input
              type="number"
              className="setting-number-input"
              min={1}
              max={480}
              value={preferences.dailyGoalMinutes ?? 30}
              onChange={(e) => {
                const v = Math.max(1, Math.min(480, parseInt(e.target.value, 10) || 30));
                onChange({ dailyGoalMinutes: v });
              }}
            />
            <span className="setting-unit">{t("minutesPerDay")}</span>
          </div>
        </div>
      </SettingGroup>

      <SettingSection label="阅读节律" />

      {/* 阅读节律 */}
      <SettingGroup label="阅读节律">
        <ToggleSetting
          label="番茄提醒"
          checked={preferences.wellness?.pomodoroEnabled ?? true}
          onChange={(v) => onChange({ wellness: { ...(preferences.wellness ?? defaultWellness), pomodoroEnabled: v } })}
        />
        {preferences.wellness?.pomodoroEnabled && (
          <label className="setting-row">
            <span>提醒间隔（分钟）</span>
            <input
              type="number"
              min={5}
              max={120}
              value={preferences.wellness?.pomodoroMinutes ?? 25}
              onChange={(e) => onChange({ wellness: { ...(preferences.wellness ?? defaultWellness), pomodoroMinutes: +e.target.value } })}
              className="setting-number-input"
            />
          </label>
        )}
        <ToggleSetting
          label="夜间护眼"
          checked={preferences.wellness?.eveningModeEnabled ?? true}
          onChange={(v) => onChange({ wellness: { ...(preferences.wellness ?? defaultWellness), eveningModeEnabled: v } })}
        />
        <ToggleSetting
          label="每日结算卡"
          checked={preferences.wellness?.showDailySummary ?? true}
          onChange={(v) => onChange({ wellness: { ...(preferences.wellness ?? defaultWellness), showDailySummary: v } })}
        />
      </SettingGroup>

      <SettingSection label={t("dataManagement")} />

      <SettingGroup label={t("dataManagement")}>
        <div className="data-management-row">
          <button
            className="soft-button pressable stretch-button"
            type="button"
            onClick={() => void window.readerApi.exportData()}
          >
            <span>{t("exportData")}</span>
          </button>
          <button
            className="soft-button pressable stretch-button"
            type="button"
            onClick={() => void window.readerApi.importData()}
          >
            <span>{t("importData")}</span>
          </button>
        </div>
        <p className="setting-help-text">导出书签、高亮和阅读记录为 JSON；导入时按文件哈希合并，本地文件路径不受影响。</p>
      </SettingGroup>

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
