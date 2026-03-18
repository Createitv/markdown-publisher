import type { PlasmoCSConfig } from "plasmo"

import { delay, setNativeValue, waitForSelector } from "../utils/dom-helpers"
import { getParsedDocument } from "../utils/storage"
import type { FillMessage, FillResult } from "../utils/types"

export const config: PlasmoCSConfig = {
  matches: [
    "https://www.reddit.com/submit*",
    "https://www.reddit.com/r/*/submit*"
  ]
}

async function fillEditor(): Promise<FillResult> {
  const doc = await getParsedDocument()
  if (!doc) {
    return { success: false, platformId: "reddit", error: "No parsed document found" }
  }

  try {
    // Try to switch to Markdown mode if available
    const mdTab = document.querySelector<HTMLElement>(
      "button[role='tab'][aria-label*='arkdown'], button[slot='page'][name='markdown']"
    )
    if (mdTab) {
      mdTab.click()
      await delay(500)
    }

    // Title — Reddit uses a textarea for the title
    const titleEl = await waitForSelector(
      "textarea[name='title'], input[name='title'], textarea[placeholder*='title' i], [slot='title'] textarea"
    )
    if (titleEl) {
      const title = doc.title.slice(0, 300) // Reddit max 300 chars
      if (titleEl instanceof HTMLTextAreaElement || titleEl instanceof HTMLInputElement) {
        setNativeValue(titleEl, title)
      }
    }

    // Body — markdown textarea
    const bodyEl = await waitForSelector(
      "textarea[name='body'], textarea[slot='textbox'], div[slot='markdown'] textarea, .RichTextJSON-root textarea"
    )
    if (bodyEl instanceof HTMLTextAreaElement) {
      const body = doc.body.slice(0, 40000)
      setNativeValue(bodyEl, body)
    }

    return { success: true, platformId: "reddit" }
  } catch (e) {
    return {
      success: false,
      platformId: "reddit",
      error: e instanceof Error ? e.message : "Failed to fill editor"
    }
  }
}

chrome.runtime.onMessage.addListener(
  (message: FillMessage, _sender, sendResponse) => {
    if (message.action === "fill-editor" && message.platformId === "reddit") {
      fillEditor().then(sendResponse)
      return true
    }
  }
)
