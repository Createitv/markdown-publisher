import { useCallback, useEffect, useState } from "react"

import { Storage } from "@plasmohq/storage"

export type Locale = "en" | "zh"

const storage = new Storage({ area: "local" })
const LOCALE_KEY = "locale"

const translations: Record<Locale, Record<string, string>> = {
  en: {
    channels: "Channels",
    selectFirst: "Select first",
    selected: "selected",
    selectChannelsBeforeDrag:
      "Select channels before choosing or dragging a folder",
    parsingMarkdown: "Parsing markdown...",
    chooseFolderOrDrag: "Choose a folder or drag a folder / .md file here",
    chooseFolder: "Choose folder",
    chooseMdFile: "Choose .md file",
    title: "Title",
    articleTitle: "Article title",
    tags: "Tags",
    addTag: "Add tag...",
    subreddit: "Subreddit",
    xPostPreview: "X post preview",
    chars: "chars",
    selectPlatform: "Select a platform",
    fillOneEditor: "Fill {name} Editor",
    fillMultipleEditors: "Fill {count} Editors",
    openingEditors: "Opening {count} editor(s)...",
    pleaseUploadMd: "Please upload a .md or .markdown file",
    noMarkdownFound:
      "No markdown file found in the selected files or folder",
    selectChannelBeforeFolder:
      "Please select at least one channel before choosing a folder",
    selectChannelBeforeFile:
      "Please select at least one channel before choosing a markdown file",
    selectChannelsThenDrag:
      "Select channels first, then drag a folder or markdown file here",
    failedNames: "Failed: {names}",
    failedToFill: "Failed to fill editors",
    failedToParse: "Failed to parse markdown"
  },
  zh: {
    channels: "频道",
    selectFirst: "请先选择",
    selected: "已选",
    selectChannelsBeforeDrag: "请先选择频道，再拖入文件夹",
    parsingMarkdown: "正在解析...",
    chooseFolderOrDrag: "选择文件夹或拖入文件夹 / .md 文件",
    chooseFolder: "选择文件夹",
    chooseMdFile: "选择 .md 文件",
    title: "标题",
    articleTitle: "文章标题",
    tags: "标签",
    addTag: "添加标签...",
    subreddit: "Subreddit",
    xPostPreview: "X 帖子预览",
    chars: "字符",
    selectPlatform: "请选择平台",
    fillOneEditor: "填充 {name} 编辑器",
    fillMultipleEditors: "填充 {count} 个编辑器",
    openingEditors: "正在打开 {count} 个编辑器...",
    pleaseUploadMd: "请上传 .md 或 .markdown 文件",
    noMarkdownFound: "所选文件或文件夹中未找到 Markdown 文件",
    selectChannelBeforeFolder: "请先选择至少一个频道",
    selectChannelBeforeFile: "请先选择至少一个频道",
    selectChannelsThenDrag: "请先选择频道，再拖入文件夹或 Markdown 文件",
    failedNames: "失败: {names}",
    failedToFill: "填充编辑器失败",
    failedToParse: "Markdown 解析失败"
  }
}

function detectLocale(): Locale {
  const lang = navigator.language ?? ""
  return lang.startsWith("zh") ? "zh" : "en"
}

export function useI18n() {
  const [locale, setLocaleState] = useState<Locale>(detectLocale)

  useEffect(() => {
    storage.get<Locale>(LOCALE_KEY).then((saved) => {
      if (saved === "en" || saved === "zh") {
        setLocaleState(saved)
      }
    })
  }, [])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    storage.set(LOCALE_KEY, newLocale)
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let value = translations[locale]?.[key] ?? translations.en[key] ?? key
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replace(`{${k}}`, String(v))
        }
      }
      return value
    },
    [locale]
  )

  return { t, locale, setLocale }
}
