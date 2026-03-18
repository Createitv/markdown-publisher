import type { PlasmoCSConfig } from "plasmo"

import { insertHtmlIntoContentEditable, waitForSelector } from "../utils/dom-helpers"
import { markdownToHtml } from "../utils/html-converter"
import { getParsedDocument } from "../utils/storage"
import type { FillMessage, FillResult } from "../utils/types"

export const config: PlasmoCSConfig = {
  matches: ["https://medium.com/new-story*", "https://medium.com/p/*/edit*"]
}

async function fillEditor(): Promise<FillResult> {
  const doc = await getParsedDocument()
  if (!doc) {
    return { success: false, platformId: "medium", error: "No parsed document found" }
  }

  try {
    // Title — Medium uses a contenteditable element for the title
    const titleEl = await waitForSelector(
      "h3[data-contents] div[data-block], h4[data-contents], [role='textbox'] h3, [data-testid='editorTitle'], section[contenteditable] h3"
    )
    if (titleEl instanceof HTMLElement) {
      titleEl.textContent = doc.title.slice(0, 100)
      titleEl.dispatchEvent(new Event("input", { bubbles: true }))
    }

    // Body — contenteditable div
    const bodyEl = await waitForSelector(
      "[role='textbox'] div[data-contents], .section-content, section[contenteditable='true']"
    )
    if (bodyEl instanceof HTMLElement) {
      const html = markdownToHtml(doc.body)
      insertHtmlIntoContentEditable(bodyEl, html)
    }

    return { success: true, platformId: "medium" }
  } catch (e) {
    return {
      success: false,
      platformId: "medium",
      error: e instanceof Error ? e.message : "Failed to fill editor"
    }
  }
}

chrome.runtime.onMessage.addListener(
  (message: FillMessage, _sender, sendResponse) => {
    if (message.action === "fill-editor" && message.platformId === "medium") {
      fillEditor().then(sendResponse)
      return true
    }
  }
)
