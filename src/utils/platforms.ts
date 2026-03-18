import type { EditorType, PlatformId } from "./types"

export interface PlatformConfig {
  id: PlatformId
  name: string
  maxTags: number
  maxTitleLength?: number
  maxBodyLength?: number
  editorType: EditorType
  contentStrategy: "full" | "excerpt"
  url: string
  loadDelay: number
  enabled: boolean
}

export const PLATFORMS: Record<PlatformId, PlatformConfig> = {
  devto: {
    id: "devto",
    name: "Dev.to",
    maxTags: 4,
    editorType: "markdown",
    contentStrategy: "full",
    url: "https://dev.to/new",
    loadDelay: 1500,
    enabled: true
  },
  reddit: {
    id: "reddit",
    name: "Reddit",
    maxTags: 0,
    maxTitleLength: 300,
    maxBodyLength: 40000,
    editorType: "markdown",
    contentStrategy: "full",
    url: "https://www.reddit.com/submit?type=self",
    loadDelay: 2000,
    enabled: true
  },
  medium: {
    id: "medium",
    name: "Medium",
    maxTags: 5,
    maxTitleLength: 100,
    editorType: "richtext",
    contentStrategy: "full",
    url: "https://medium.com/new-story",
    loadDelay: 2000,
    enabled: true
  },
  twitter: {
    id: "twitter",
    name: "X (Twitter)",
    maxTags: 0,
    editorType: "plaintext",
    contentStrategy: "full",
    url: "https://x.com/compose/post",
    loadDelay: 1500,
    enabled: true
  },
  "twitter-articles": {
    id: "twitter-articles",
    name: "X Articles",
    maxTags: 0,
    editorType: "richtext",
    contentStrategy: "full",
    url: "https://x.com/compose/articles",
    loadDelay: 3000,
    enabled: true
  },
  substack: {
    id: "substack",
    name: "Substack",
    maxTags: 0,
    editorType: "richtext",
    contentStrategy: "full",
    url: "https://flowiox.substack.com/publish/post?type=newsletter",
    loadDelay: 2500,
    enabled: true
  }
}

export const enabledPlatforms = Object.values(PLATFORMS).filter(
  (p) => p.enabled
)
