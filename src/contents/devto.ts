import type { PlasmoCSConfig } from "plasmo"

import { delay, setNativeValue } from "../utils/dom-helpers"
import { getParsedDocument } from "../utils/storage"
import type { FillMessage, FillResult } from "../utils/types"

export const config: PlasmoCSConfig = {
  matches: ["https://dev.to/new*"]
}

async function fillEditor(): Promise<FillResult> {
  const doc = await getParsedDocument()
  if (!doc) {
    return { success: false, platformId: "devto", error: "No parsed document found" }
  }

  try {
    const titleInput = document.querySelector<HTMLInputElement>(
      "#article-form-title, #article_title, textarea[name='article[title]']"
    )
    if (titleInput) setNativeValue(titleInput, doc.title)

    const bodyTextarea = document.querySelector<HTMLTextAreaElement>(
      "#article_body_markdown, textarea[name='article[body_markdown]']"
    )
    if (bodyTextarea) setNativeValue(bodyTextarea, doc.body)

    const tagsToFill = (doc.selectedTags ?? doc.tags).slice(0, 4)
    if (tagsToFill.length > 0) {
      const tagInput = document.querySelector<HTMLInputElement>(
        "#tag-input, input[name='article[tag_list]']"
      )
      if (tagInput) {
        for (const tag of tagsToFill) {
          setNativeValue(tagInput, tag)
          tagInput.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: ",",
              code: "Comma",
              keyCode: 188,
              bubbles: true
            })
          )
          await delay(100)
        }
      }
    }

    return { success: true, platformId: "devto" }
  } catch (e) {
    return {
      success: false,
      platformId: "devto",
      error: e instanceof Error ? e.message : "Failed to fill editor"
    }
  }
}

chrome.runtime.onMessage.addListener(
  (message: FillMessage, _sender, sendResponse) => {
    if (message.action === "fill-editor" && message.platformId === "devto") {
      fillEditor().then(sendResponse)
      return true
    }
  }
)
