export type PlatformId = "devto" | "reddit" | "medium" | "twitter" | "substack"

export type EditorType = "markdown" | "richtext" | "plaintext"

export interface ParsedDocument {
  title: string
  tags: string[]
  selectedTags: string[]
  description: string
  body: string
  rawMarkdown: string
}

export type FillStatus =
  | "idle"
  | "parsing"
  | "ready"
  | "filling"
  | "success"
  | "error"

export interface FillMessage {
  action: "fill-editor"
  platformId: PlatformId
}

export interface FillResult {
  success: boolean
  platformId?: PlatformId
  error?: string
}
