import { useCallback, useEffect, useRef, useState } from "react"

import { useI18n } from "./utils/i18n"
import { parseMarkdown } from "./utils/markdown-parser"
import {
  type PlatformConfig,
  PLATFORMS,
  enabledPlatforms
} from "./utils/platforms"
import {
  getSelectedPlatforms,
  getSubreddit,
  saveParsedDocument,
  saveSelectedPlatforms,
  saveSubreddit
} from "./utils/storage"
import type {
  FillResult,
  FillStatus,
  ParsedDocument,
  PlatformId
} from "./utils/types"

import "./style.css"

type WebkitFileSystemEntry = {
  isDirectory: boolean
  isFile: boolean
  fullPath?: string
  createReader?: () => {
    readEntries: (callback: (entries: WebkitFileSystemEntry[]) => void) => void
  }
  file?: (callback: (file: File) => void) => void
}

type WebkitDataTransferItem = DataTransferItem & {
  webkitGetAsEntry?: () => WebkitFileSystemEntry | null
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isMarkdownFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith(".md") || name.endsWith(".markdown")
}

function sortMarkdownFiles(files: File[]): File[] {
  return [...files].sort((a, b) =>
    a.webkitRelativePath.localeCompare(b.webkitRelativePath)
  )
}

async function readEntryFiles(entry: WebkitFileSystemEntry): Promise<File[]> {
  if (entry.isFile && entry.file) {
    const file = await new Promise<File>((resolve, reject) => {
      try {
        entry.file?.(resolve)
      } catch (error) {
        reject(error)
      }
    })
    return isMarkdownFile(file) ? [file] : []
  }

  if (!entry.isDirectory || !entry.createReader) return []

  const reader = entry.createReader()
  const entries: WebkitFileSystemEntry[] = []

  while (true) {
    const chunk = await new Promise<WebkitFileSystemEntry[]>((resolve) => {
      reader.readEntries(resolve)
    })

    if (chunk.length === 0) break
    entries.push(...chunk)
  }

  const nested = await Promise.all(
    entries.map((nestedEntry) => readEntryFiles(nestedEntry))
  )
  return nested.flat()
}

function Popup() {
  const { t, locale, setLocale } = useI18n()
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [doc, setDoc] = useState<ParsedDocument | null>(null)
  const [fileName, setFileName] = useState("")
  const [fileSize, setFileSize] = useState(0)
  const [status, setStatus] = useState<FillStatus>("idle")
  const [error, setError] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [tagInput, setTagInput] = useState("")
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<PlatformId>>(
    new Set()
  )
  const [subreddit, setSubredditState] = useState("")
  const [fillResults, setFillResults] = useState<FillResult[]>([])

  // Load persisted preferences
  useEffect(() => {
    getSelectedPlatforms().then((ids) =>
      setSelectedPlatforms(
        new Set(ids.filter((id): id is PlatformId => id in PLATFORMS))
      )
    )
    getSubreddit().then(setSubredditState)
  }, [])

  useEffect(() => {
    if (!folderInputRef.current) return
    folderInputRef.current.setAttribute("webkitdirectory", "")
    folderInputRef.current.setAttribute("directory", "")
    folderInputRef.current.setAttribute("multiple", "")
  }, [])

  const selectedConfigs = enabledPlatforms.filter((p) =>
    selectedPlatforms.has(p.id)
  )
  const hasSelectedPlatforms = selectedPlatforms.size > 0
  const effectiveMaxTags =
    selectedConfigs.length > 0
      ? Math.min(...selectedConfigs.map((p) => p.maxTags).filter((n) => n > 0))
      : 4
  const selectedTags = doc?.selectedTags ?? []
  const atTagLimit =
    effectiveMaxTags > 0 && selectedTags.length >= effectiveMaxTags

  const togglePlatform = useCallback((id: PlatformId) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      saveSelectedPlatforms([...next])
      return next
    })
    setFillResults([])
  }, [])

  const updateDoc = useCallback(
    (updater: (prev: ParsedDocument) => ParsedDocument) => {
      setDoc((prev) => {
        if (!prev) return prev
        const next = updater(prev)
        saveParsedDocument(next)
        return next
      })
    },
    []
  )

  const toggleTag = useCallback(
    (tag: string) => {
      updateDoc((prev) => {
        const has = prev.selectedTags.includes(tag)
        if (has) {
          return {
            ...prev,
            selectedTags: prev.selectedTags.filter((t) => t !== tag)
          }
        }
        if (
          effectiveMaxTags > 0 &&
          prev.selectedTags.length >= effectiveMaxTags
        )
          return prev
        return { ...prev, selectedTags: [...prev.selectedTags, tag] }
      })
    },
    [updateDoc, effectiveMaxTags]
  )

  const addTag = useCallback(
    (raw: string) => {
      const tag = raw
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
      if (!tag) return
      updateDoc((prev) => {
        if (prev.tags.includes(tag)) return prev
        if (
          effectiveMaxTags > 0 &&
          prev.selectedTags.length >= effectiveMaxTags
        )
          return prev
        return {
          ...prev,
          tags: [...prev.tags, tag],
          selectedTags: [...prev.selectedTags, tag]
        }
      })
      setTagInput("")
    },
    [updateDoc, effectiveMaxTags]
  )

  const resetDocumentState = useCallback(() => {
    setDoc(null)
    setFileName("")
    setFileSize(0)
    setTagInput("")
    setFillResults([])
    setStatus("idle")
    setError("")
  }, [])

  const resolveMarkdownFile = useCallback(async (files: FileList | File[]) => {
    const markdownFiles = sortMarkdownFiles(
      Array.from(files).filter(isMarkdownFile)
    )

    if (markdownFiles.length > 0) {
      return markdownFiles[0]
    }

    return null
  }, [])

  const handleFile = useCallback(
    async (file: File) => {
      if (!isMarkdownFile(file)) {
        setError(t("pleaseUploadMd"))
        return
      }
      setStatus("parsing")
      setError("")
      setFileName(file.name)
      setFileSize(file.size)
      setFillResults([])

      try {
        const text = await file.text()
        const parsed = parseMarkdown(text)
        const limit =
          effectiveMaxTags > 0 ? effectiveMaxTags : parsed.tags.length
        const docWithSelection = {
          ...parsed,
          selectedTags: parsed.tags.slice(0, limit)
        }
        await saveParsedDocument(docWithSelection)
        setDoc(docWithSelection)
        setStatus("ready")
        chrome.runtime.sendMessage({ action: "doc-ready" })
      } catch (e) {
        setError(e instanceof Error ? e.message : t("failedToParse"))
        setStatus("error")
      }
    },
    [effectiveMaxTags, t]
  )

  const handleFileSelection = useCallback(
    async (files: FileList | File[]) => {
      if (!hasSelectedPlatforms) {
        setError(t("selectChannelBeforeFolder"))
        return
      }

      const file = await resolveMarkdownFile(files)
      if (!file) {
        setError(t("noMarkdownFound"))
        setStatus("error")
        return
      }

      if (doc) {
        resetDocumentState()
      }

      await handleFile(file)
    },
    [
      doc,
      handleFile,
      hasSelectedPlatforms,
      resetDocumentState,
      resolveMarkdownFile,
      t
    ]
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      if (!hasSelectedPlatforms) {
        setError(t("selectChannelsThenDrag"))
        return
      }

      const items = Array.from(e.dataTransfer.items ?? [])
      const filesFromEntries = await Promise.all(
        items.map(async (item) => {
          const entry = (item as WebkitDataTransferItem).webkitGetAsEntry?.()
          return entry ? readEntryFiles(entry) : []
        })
      )
      const droppedFiles = filesFromEntries.flat()

      if (droppedFiles.length > 0) {
        await handleFileSelection(droppedFiles)
        return
      }

      if (e.dataTransfer.files.length > 0) {
        await handleFileSelection(e.dataTransfer.files)
      }
    },
    [handleFileSelection, hasSelectedPlatforms, t]
  )

  const handleFolderInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files?.length) {
        await handleFileSelection(files)
      }
      e.target.value = ""
    },
    [handleFileSelection]
  )

  const handleSingleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        await handleFileSelection([file])
      }
      e.target.value = ""
    },
    [handleFileSelection]
  )

  const handleFill = useCallback(async () => {
    if (!doc || selectedPlatforms.size === 0) return
    setStatus("filling")
    setError("")
    setFillResults([])

    try {
      const resp = await chrome.runtime.sendMessage({
        action: "open-platforms",
        platformIds: [...selectedPlatforms],
        subreddit: subreddit || undefined
      })
      setFillResults(resp.results ?? [])
      const allOk = resp.results?.every((r: FillResult) => r.success)
      setStatus(allOk ? "success" : "error")
      if (!allOk) {
        const failed = resp.results
          ?.filter((r: FillResult) => !r.success)
          .map((r: FillResult) => r.platformId || "unknown")
        setError(t("failedNames", { names: failed?.join(", ") ?? "" }))
      }
      chrome.runtime.sendMessage({ action: "doc-cleared" })
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failedToFill"))
      setStatus("error")
    }
  }, [doc, selectedPlatforms, subreddit, t])

  const platformCount = selectedPlatforms.size
  const buttonLabel =
    platformCount === 0
      ? t("selectPlatform")
      : platformCount === 1
        ? t("fillOneEditor", { name: PLATFORMS[[...selectedPlatforms][0]].name })
        : t("fillMultipleEditors", { count: platformCount })

  return (
    <div className="w-96 p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-gray-900">
          Markdown Publisher
        </h1>
        <button
          type="button"
          onClick={() => setLocale(locale === "en" ? "zh" : "en")}
          className="text-xs px-2 py-0.5 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
        >
          {locale === "en" ? "中文" : "EN"}
        </button>
      </div>

      {/* Platform selector */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs text-gray-500">{t("channels")}</label>
          <span className="text-xs text-gray-400">
            {platformCount === 0 ? t("selectFirst") : `${platformCount} ${t("selected")}`}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {enabledPlatforms.map((p) => (
            <label
              key={p.id}
              className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md border cursor-pointer transition-colors ${
                selectedPlatforms.has(p.id)
                  ? "border-blue-300 bg-blue-50 text-blue-800"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedPlatforms.has(p.id)}
                onChange={() => togglePlatform(p.id)}
                className="sr-only"
              />
              <span
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                  selectedPlatforms.has(p.id)
                    ? "bg-blue-600 border-blue-600"
                    : "border-gray-300"
                }`}
              >
                {selectedPlatforms.has(p.id) && (
                  <svg
                    className="w-2.5 h-2.5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </span>
              <span className="truncate">{p.name}</span>
              {p.maxTags > 0 && (
                <span className="ml-auto text-gray-400 shrink-0">
                  {p.maxTags}t
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!hasSelectedPlatforms) return
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          hasSelectedPlatforms
            ? isDragging
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300"
            : "border-gray-200 bg-gray-50 opacity-70"
        }`}
      >
        <input
          ref={folderInputRef}
          id="folder-input"
          type="file"
          className="hidden"
          onChange={handleFolderInput}
        />
        <input
          ref={fileInputRef}
          id="file-input"
          type="file"
          accept="*/*"
          className="hidden"
          onChange={handleSingleFileInput}
        />
        <p className="text-sm text-gray-500">
          {!hasSelectedPlatforms
            ? t("selectChannelsBeforeDrag")
            : status === "parsing"
              ? t("parsingMarkdown")
              : t("chooseFolderOrDrag")}
        </p>
        <div className="mt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!hasSelectedPlatforms) {
                setError(t("selectChannelBeforeFolder"))
                return
              }
              folderInputRef.current?.click()
            }}
            disabled={!hasSelectedPlatforms}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:text-gray-400 disabled:hover:text-gray-400"
          >
            {t("chooseFolder")}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!hasSelectedPlatforms) {
                setError(t("selectChannelBeforeFile"))
                return
              }
              fileInputRef.current?.click()
            }}
            disabled={!hasSelectedPlatforms}
            className="text-sm text-gray-600 hover:text-gray-700 font-medium disabled:text-gray-400 disabled:hover:text-gray-400"
          >
            {t("chooseMdFile")}
          </button>
        </div>
      </div>

      {/* Parsed info */}
      {doc && (
        <div className="mt-3 space-y-3">
          {/* File info */}
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-medium text-gray-900 truncate">
              {fileName}
            </p>
            <span className="text-xs text-gray-400 ml-2 shrink-0">
              {formatFileSize(fileSize)}
            </span>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t("title")}</label>
            <input
              type="text"
              value={doc.title}
              onChange={(e) =>
                updateDoc((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder={t("articleTitle")}
              className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Tags */}
          {effectiveMaxTags > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">{t("tags")}</label>
                <span
                  className={`text-xs ${atTagLimit ? "text-amber-500" : "text-gray-400"}`}
                >
                  {selectedTags.length}/{effectiveMaxTags}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {doc.tags.map((tag) => {
                  const selected = selectedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        selected
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : "bg-white text-gray-400 border-gray-200 line-through"
                      } ${!selected && atTagLimit ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
              {!atTagLimit && (
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault()
                      addTag(tagInput)
                    }
                  }}
                  placeholder={t("addTag")}
                  className="mt-1.5 w-full text-xs border border-gray-200 rounded-md px-2.5 py-1 focus:outline-none focus:border-blue-400"
                />
              )}
            </div>
          )}

          {/* Reddit subreddit input */}
          {selectedPlatforms.has("reddit") && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t("subreddit")}
              </label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-400">r/</span>
                <input
                  type="text"
                  value={subreddit}
                  onChange={(e) => {
                    setSubredditState(e.target.value)
                    saveSubreddit(e.target.value)
                  }}
                  placeholder="webdev"
                  className="flex-1 text-sm border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
          )}

          {/* X preview */}
          {selectedPlatforms.has("twitter") && (
            <div className="p-2 bg-gray-50 rounded-md">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">{t("xPostPreview")}</span>
                <span className="text-xs text-gray-400">
                  {(doc.title + "\n\n" + doc.body).length} {t("chars")}
                </span>
              </div>
              <p className="text-xs text-gray-700 font-medium">{doc.title}</p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-3">
                {doc.body.slice(0, 200)}...
              </p>
            </div>
          )}

          {/* Fill button */}
          {(status === "ready" ||
            status === "success" ||
            status === "error") && (
            <button
              onClick={handleFill}
              disabled={platformCount === 0}
              className="w-full bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {buttonLabel}
            </button>
          )}

          {/* Per-platform results */}
          {fillResults.length > 0 && (
            <div className="space-y-1">
              {fillResults.map((r) => (
                <div
                  key={r.platformId}
                  className="flex items-center gap-2 text-xs px-2 py-1 rounded"
                >
                  <span>{r.success ? "\u2705" : "\u274C"}</span>
                  <span
                    className={r.success ? "text-green-700" : "text-red-600"}
                  >
                    {PLATFORMS[r.platformId as PlatformId]?.name ??
                      r.platformId}
                    {r.error ? ` — ${r.error}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Status */}
      {status === "filling" && (
        <p className="mt-2 text-sm text-amber-600">
          {t("openingEditors", { count: platformCount })}
        </p>
      )}
      {error && !fillResults.length && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}

export default Popup
