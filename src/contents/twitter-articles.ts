import type { PlasmoCSConfig } from "plasmo"

import {
  delay,
  insertHtmlIntoContentEditable,
  setNativeValue,
  waitForSelector
} from "../utils/dom-helpers"
import { markdownToHtml } from "../utils/html-converter"
import { getParsedDocument } from "../utils/storage"
import type { FillMessage, FillResult } from "../utils/types"

export const config: PlasmoCSConfig = {
  matches: [
    "https://x.com/compose/articles*",
    "https://twitter.com/compose/articles*"
  ]
}

function isVisible(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false
  const style = window.getComputedStyle(el)
  const rect = el.getBoundingClientRect()
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    rect.width > 0 &&
    rect.height > 0
  )
}

function findTitleElement(): HTMLTextAreaElement | HTMLElement | null {
  // X Articles title is a <textarea> with placeholder "Add a title"
  const textareaSelectors = [
    'textarea[name="Article Title"]',
    'textarea[placeholder*="title" i]',
    'textarea[placeholder*="Add a title"]'
  ]

  for (const sel of textareaSelectors) {
    const el = document.querySelector(sel)
    if (el && isVisible(el)) return el as HTMLTextAreaElement
  }

  // Fallback: contenteditable elements
  const editableSelectors = [
    "[contenteditable='true'][data-placeholder*='title' i]",
    "[contenteditable='true'][placeholder*='title' i]",
    "[contenteditable='true'][aria-label*='title' i]",
    "[data-testid='articleTitle'] [contenteditable='true']",
    "[role='textbox'][data-testid='articleTitle']"
  ]

  for (const sel of editableSelectors) {
    const el = document.querySelector(sel)
    if (el && isVisible(el)) return el as HTMLElement
  }

  // Fallback: find all contenteditable elements and look for title-like hints
  const editables = Array.from(
    document.querySelectorAll("[contenteditable='true']")
  ).filter(isVisible)

  for (const el of editables) {
    const hint = [
      el.getAttribute("placeholder"),
      el.getAttribute("data-placeholder"),
      el.getAttribute("aria-label"),
      (el.textContent ?? "").trim().slice(0, 50)
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    if (hint.includes("title") || hint.includes("add a title")) {
      return el as HTMLElement
    }
  }

  return null
}

function findBodyElement(titleEl?: Element | null): HTMLElement | null {
  // X Articles body is a contenteditable with placeholder "Start writing"
  const selectors = [
    "[contenteditable='true'][data-placeholder*='Start writing' i]",
    "[contenteditable='true'][placeholder*='Start writing' i]",
    "[contenteditable='true'][aria-label*='Start writing' i]",
    "[contenteditable='true'][data-placeholder*='Write' i]",
    ".ProseMirror[contenteditable='true']",
    "[data-testid='articleBody'] [contenteditable='true']",
    "[role='textbox'][data-testid='articleBody']"
  ]

  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (el && isVisible(el) && el !== titleEl) return el as HTMLElement
  }

  // Fallback: find largest contenteditable that isn't the title
  const editables = Array.from(
    document.querySelectorAll("[contenteditable='true']")
  )
    .filter(isVisible)
    .filter((el) => el !== titleEl)

  // Check for write/body hints
  for (const el of editables) {
    const hint = [
      el.getAttribute("placeholder"),
      el.getAttribute("data-placeholder"),
      el.getAttribute("aria-label"),
      (el.textContent ?? "").trim().slice(0, 80)
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    if (
      hint.includes("start writing") ||
      hint.includes("write") ||
      hint.includes("body") ||
      hint.includes("content")
    ) {
      return el as HTMLElement
    }
  }

  // Last resort: pick the largest contenteditable by area
  const sorted = editables.sort((a, b) => {
    const aRect = a.getBoundingClientRect()
    const bRect = b.getBoundingClientRect()
    return bRect.width * bRect.height - aRect.width * aRect.height
  })

  return (sorted[0] as HTMLElement | undefined) ?? null
}

function fillTitle(el: HTMLTextAreaElement | HTMLElement, value: string) {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    // Use native setter for React-controlled textarea/input
    setNativeValue(el, value)
    return
  }

  // Contenteditable fallback
  el.focus()
  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(el)
  selection?.removeAllRanges()
  selection?.addRange(range)
  document.execCommand("insertText", false, value)

  if ((el.textContent ?? "").trim() !== value) {
    el.textContent = value
    el.dispatchEvent(new Event("input", { bubbles: true }))
  }
}

/**
 * Write HTML to the real clipboard, then dispatch a synthetic paste event.
 * This allows X's editor to process <img> tags and other rich content
 * as if the user pasted from their clipboard.
 */
async function fillBodyWithPaste(
  el: HTMLElement,
  html: string,
  plainText: string
) {
  el.focus()

  // Try writing to the real clipboard first (for image support)
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
    // Clipboard API may not be available; fall through to synthetic event
  }

  // Dispatch synthetic paste event with the HTML data
  const clipboardData = new DataTransfer()
  clipboardData.setData("text/html", html)
  clipboardData.setData("text/plain", plainText)
  const pasteEvent = new ClipboardEvent("paste", {
    clipboardData,
    bubbles: true,
    cancelable: true
  })
  el.dispatchEvent(pasteEvent)
}

async function clickWriteButton(): Promise<boolean> {
  // The X Articles landing page shows a "Write" button before the editor loads
  const writeBtn = await waitForSelector(
    '[data-testid="empty_state_button_text"]',
    5000
  )
  if (writeBtn && writeBtn instanceof HTMLElement) {
    writeBtn.click()
    return true
  }

  // Fallback: look for a link to /compose/articles that contains "Write"
  const links = Array.from(
    document.querySelectorAll('a[href*="/compose/articles"]')
  )
  for (const link of links) {
    if (link.textContent?.trim() === "Write" && isVisible(link)) {
      ;(link as HTMLElement).click()
      return true
    }
  }

  return false
}

async function fillEditor(): Promise<FillResult> {
  const doc = await getParsedDocument()
  if (!doc) {
    return {
      success: false,
      platformId: "twitter-articles",
      error: "No parsed document found"
    }
  }

  try {
    // Click the "Write" button on the landing page if present
    await clickWriteButton()
    await delay(1000)

    // Wait for the editor to load — either textarea (title) or contenteditable (body)
    await waitForSelector(
      'textarea[name="Article Title"], [contenteditable="true"]',
      10000
    )
    await delay(500)

    const titleEl = findTitleElement()
    if (titleEl) {
      fillTitle(titleEl, doc.title)
      await delay(300)
    }

    const bodyEl = findBodyElement(titleEl)
    if (bodyEl) {
      const html = markdownToHtml(doc.body)
      await fillBodyWithPaste(bodyEl, html, doc.body)

      // Fallback if paste didn't work
      await delay(300)
      if (!bodyEl.innerHTML || bodyEl.innerHTML.length < 10) {
        insertHtmlIntoContentEditable(bodyEl, html)
      }
    }

    if (!titleEl && !bodyEl) {
      return {
        success: false,
        platformId: "twitter-articles",
        error: "Could not find X Articles title or body editor"
      }
    }

    return { success: true, platformId: "twitter-articles" }
  } catch (e) {
    return {
      success: false,
      platformId: "twitter-articles",
      error: e instanceof Error ? e.message : "Failed to fill editor"
    }
  }
}

chrome.runtime.onMessage.addListener(
  (message: FillMessage, _sender, sendResponse) => {
    if (
      message.action === "fill-editor" &&
      message.platformId === "twitter-articles"
    ) {
      fillEditor().then(sendResponse)
      return true
    }
  }
)
