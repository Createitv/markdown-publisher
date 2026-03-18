import { PLATFORMS } from "./utils/platforms"
import { clearParsedDocument } from "./utils/storage"
import type { FillMessage, FillResult, PlatformId } from "./utils/types"

// --- Icon management (unchanged) ---

async function makeIconData(
  color: string,
  opacity: number
): Promise<Record<string, ImageData>> {
  const sizes = [16, 32, 48, 128]
  const result: Record<string, ImageData> = {}

  for (const size of sizes) {
    const canvas = new OffscreenCanvas(size, size)
    const ctx = canvas.getContext("2d")!
    const r = size * 0.1875

    ctx.beginPath()
    ctx.moveTo(r, 0)
    ctx.lineTo(size - r, 0)
    ctx.quadraticCurveTo(size, 0, size, r)
    ctx.lineTo(size, size - r)
    ctx.quadraticCurveTo(size, size, size - r, size)
    ctx.lineTo(r, size)
    ctx.quadraticCurveTo(0, size, 0, size - r)
    ctx.lineTo(0, r)
    ctx.quadraticCurveTo(0, 0, r, 0)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()

    const s = size / 128
    ctx.strokeStyle = `rgba(255,255,255,${opacity})`
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    ctx.lineWidth = 9 * s
    ctx.beginPath()
    ctx.moveTo(38 * s, 38 * s)
    ctx.lineTo(56 * s, 64 * s)
    ctx.lineTo(38 * s, 90 * s)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(68 * s, 38 * s)
    ctx.lineTo(50 * s, 64 * s)
    ctx.lineTo(68 * s, 90 * s)
    ctx.stroke()

    ctx.lineWidth = 7 * s
    ctx.beginPath()
    ctx.moveTo(78 * s, 56 * s)
    ctx.lineTo(94 * s, 40 * s)
    ctx.lineTo(94 * s, 54 * s)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(94 * s, 40 * s)
    ctx.lineTo(80 * s, 40 * s)
    ctx.stroke()

    ctx.globalAlpha = opacity * 0.7
    ctx.beginPath()
    ctx.moveTo(76 * s, 90 * s)
    ctx.lineTo(96 * s, 90 * s)
    ctx.stroke()
    ctx.globalAlpha = 1

    result[String(size)] = ctx.getImageData(0, 0, size, size)
  }
  return result
}

let activeIcons: Record<string, ImageData> | null = null
let inactiveIcons: Record<string, ImageData> | null = null

async function setActiveIcon() {
  if (!activeIcons) activeIcons = await makeIconData("#6366f1", 1)
  chrome.action.setIcon({ imageData: activeIcons })
}

async function setInactiveIcon() {
  if (!inactiveIcons) inactiveIcons = await makeIconData("#9CA3AF", 0.6)
  chrome.action.setIcon({ imageData: inactiveIcons })
}

setInactiveIcon()

// --- Multi-platform routing ---

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "open-platforms") {
    const { platformIds, subreddit } = message as {
      platformIds: PlatformId[]
      subreddit?: string
    }
    openAndFillMultiple(platformIds, subreddit).then(sendResponse)
    return true
  }
  if (message.action === "doc-ready") {
    setActiveIcon()
    return
  }
  if (message.action === "doc-cleared") {
    setInactiveIcon()
    return
  }
})

async function openAndFillPlatform(
  platformId: PlatformId,
  subreddit?: string
): Promise<FillResult> {
  const config = PLATFORMS[platformId]
  if (!config || !config.enabled) {
    return { success: false, platformId, error: `${platformId} is not enabled` }
  }

  try {
    let url = config.url
    // Reddit subreddit interpolation
    if (platformId === "reddit" && subreddit) {
      url = `https://www.reddit.com/r/${subreddit}/submit?type=self`
    }

    const tab = await chrome.tabs.create({ url })
    await waitForTabLoad(tab.id!)
    await delay(config.loadDelay)

    const result = await chrome.tabs.sendMessage<FillMessage, FillResult>(
      tab.id!,
      { action: "fill-editor", platformId }
    )
    return { ...result, platformId }
  } catch (e) {
    return {
      success: false,
      platformId,
      error: e instanceof Error ? e.message : `Failed to fill ${config.name}`
    }
  }
}

async function openAndFillMultiple(
  platformIds: PlatformId[],
  subreddit?: string
): Promise<{ results: FillResult[] }> {
  const results = await Promise.allSettled(
    platformIds.map((id) => openAndFillPlatform(id, subreddit))
  )

  const fillResults = results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { success: false, error: "Unexpected error" } as FillResult
  )

  // Clear document after all platforms have been filled
  await clearParsedDocument()

  return { results: fillResults }
}

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    function listener(id: number, changeInfo: chrome.tabs.TabChangeInfo) {
      if (id === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }
    chrome.tabs.onUpdated.addListener(listener)
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
