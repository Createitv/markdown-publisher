import type { PlasmoCSConfig } from "plasmo"

import { delay, waitForSelector } from "../utils/dom-helpers"
import { markdownToHtml } from "../utils/html-converter"
import { getParsedDocument } from "../utils/storage"
import type { FillMessage, FillResult } from "../utils/types"

export const config: PlasmoCSConfig = {
  matches: ["https://medium.com/new-story*", "https://medium.com/p/*/edit*"]
}

/**
 * Medium's legacy editor structure (after JS initialization):
 *
 *   .postArticle-content.js-postField  [contenteditable root]
 *     section.section--first
 *       .section-content
 *         .section-inner.sectionLayout--insetColumn
 *           h3.graf.graf--h3.graf--title     ← title
 *           p.graf.graf--p                   ← body paragraphs
 */

function findTitleElement(): HTMLElement | null {
  const selectors = [
    ".graf--title",
    ".postArticle-content h3.graf--h3",
    ".section--first .section-inner h3",
    "h3[data-contents] div[data-block]",
    "[role='textbox'] h3",
    "[data-testid='editorTitle']",
    "section[contenteditable] h3"
  ]

  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (el instanceof HTMLElement) return el
  }

  return null
}

function fillTitle(el: HTMLElement, value: string) {
  el.focus()
  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(el)
  selection?.removeAllRanges()
  selection?.addRange(range)
  document.execCommand("insertText", false, value.slice(0, 100))

  if (!(el.textContent ?? "").trim()) {
    el.textContent = value.slice(0, 100)
    el.dispatchEvent(new Event("input", { bubbles: true }))
  }
}

/**
 * Move cursor to the end of the title and press Enter to enter the body area.
 * Medium's editor creates a new p.graf element when Enter is pressed.
 */
function moveCursorAfterTitle(titleEl: HTMLElement) {
  titleEl.focus()
  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(titleEl)
  range.collapse(false)
  selection?.removeAllRanges()
  selection?.addRange(range)

  // Simulate Enter key to create a new paragraph in the body
  const enterEvent = new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  })
  titleEl.dispatchEvent(enterEvent)

  const enterPress = new KeyboardEvent("keypress", {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  })
  titleEl.dispatchEvent(enterPress)

  const enterUp = new KeyboardEvent("keyup", {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  })
  titleEl.dispatchEvent(enterUp)
}

/**
 * Paste HTML into the editor using clipboard API + synthetic paste event.
 * Targets the top-level contenteditable (.js-postField) so Medium's paste
 * handler can properly split block elements into individual graf elements.
 */
async function pasteHtmlIntoEditor(html: string, plainText: string) {
  // Find the top-level contenteditable container
  const editableRoot = document.querySelector(
    ".js-postField[contenteditable], .postArticle-content[contenteditable]"
  ) as HTMLElement | null

  // Or find any contenteditable ancestor of the current selection
  const activeEl =
    editableRoot ?? (document.activeElement as HTMLElement | null)
  if (!activeEl) return false

  // Write to real clipboard for image support
  try {
    const htmlBlob = new Blob([html], { type: "text/html" })
    const textBlob = new Blob([plainText], { type: "text/plain" })
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": htmlBlob,
        "text/plain": textBlob
      })
    ])
  } catch {
    // fall through
  }

  // Dispatch paste event on the contenteditable root
  const clipboardData = new DataTransfer()
  clipboardData.setData("text/html", html)
  clipboardData.setData("text/plain", plainText)
  const pasteEvent = new ClipboardEvent("paste", {
    clipboardData,
    bubbles: true,
    cancelable: true
  })
  activeEl.dispatchEvent(pasteEvent)

  return true
}

async function fillEditor(): Promise<FillResult> {
  const doc = await getParsedDocument()
  if (!doc) {
    return {
      success: false,
      platformId: "medium",
      error: "No parsed document found"
    }
  }

  try {
    // Wait for Medium's editor to initialize
    await waitForSelector(
      ".graf--title, .js-postField [contenteditable], h3[data-contents]",
      10000
    )
    await delay(500)

    const titleEl = findTitleElement()
    if (titleEl) {
      fillTitle(titleEl, doc.title)
      await delay(300)

      // Move cursor after title → Enter → creates new body paragraph
      moveCursorAfterTitle(titleEl)
      await delay(300)
    }

    // Now cursor should be in a new body paragraph
    const html = markdownToHtml(doc.body)
    const pasted = await pasteHtmlIntoEditor(html, doc.body)

    // Fallback: if paste didn't work, try insertHTML at current cursor
    if (pasted) {
      await delay(500)
    }

    // Check if body has content (exclude title text)
    const sectionInner = document.querySelector(
      ".section--first .section-inner, .postArticle-content .section-inner"
    )
    const bodyGrafs = sectionInner?.querySelectorAll(
      ".graf:not(.graf--title)"
    )
    const hasBody =
      bodyGrafs &&
      bodyGrafs.length > 0 &&
      Array.from(bodyGrafs).some(
        (g) => (g.textContent ?? "").trim().length > 0
      )

    if (!hasBody) {
      // Fallback: use insertHTML directly at current cursor position
      document.execCommand("insertHTML", false, html)
    }

    if (!titleEl && !sectionInner) {
      return {
        success: false,
        platformId: "medium",
        error: "Could not find Medium editor"
      }
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
