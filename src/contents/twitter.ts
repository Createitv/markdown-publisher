import type { PlasmoCSConfig } from "plasmo"

import { markdownToPlainText } from "../utils/html-converter"
import { insertTextIntoContentEditable, waitForSelector } from "../utils/dom-helpers"
import { getParsedDocument } from "../utils/storage"
import type { FillMessage, FillResult } from "../utils/types"

export const config: PlasmoCSConfig = {
  matches: ["https://x.com/compose/*", "https://twitter.com/compose/*"]
}

async function fillEditor(): Promise<FillResult> {
  const doc = await getParsedDocument()
  if (!doc) {
    return { success: false, platformId: "twitter", error: "No parsed document found" }
  }

  try {
    // X/Twitter compose box — contenteditable div
    const composeEl = await waitForSelector(
      "[role='textbox'][contenteditable='true'], div[data-testid='tweetTextarea_0'] [role='textbox']"
    )
    if (composeEl instanceof HTMLElement) {
      // Build full post: title + body + hashtags
      const parts: string[] = []

      if (doc.title) {
        parts.push(doc.title)
      }

      if (doc.body) {
        const plainBody = markdownToPlainText(doc.body)
        if (plainBody) {
          parts.push(plainBody)
        }
      }

      // Append hashtags from selected tags
      const hashtags = (doc.selectedTags ?? [])
        .map((t) => `#${t}`)
        .join(" ")
      if (hashtags) {
        parts.push(hashtags)
      }

      const text = parts.join("\n\n")
      insertTextIntoContentEditable(composeEl, text)
    }

    return { success: true, platformId: "twitter" }
  } catch (e) {
    return {
      success: false,
      platformId: "twitter",
      error: e instanceof Error ? e.message : "Failed to fill editor"
    }
  }
}

chrome.runtime.onMessage.addListener(
  (message: FillMessage, _sender, sendResponse) => {
    if (message.action === "fill-editor" && message.platformId === "twitter") {
      fillEditor().then(sendResponse)
      return true
    }
  }
)
