import type { PlasmoCSConfig } from "plasmo"

import {
  insertHtmlIntoContentEditable,
  setNativeValue,
  waitForSelector
} from "../utils/dom-helpers"
import { markdownToHtml } from "../utils/html-converter"
import { getParsedDocument } from "../utils/storage"
import type { FillMessage, FillResult } from "../utils/types"

export const config: PlasmoCSConfig = {
  matches: [
    "https://*.substack.com/publish/post*",
    "https://substack.com/publish/post*"
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

function includesHint(value: string | null | undefined, hints: string[]) {
  const normalized = (value ?? "").toLowerCase()
  return hints.some((hint) => normalized.includes(hint))
}

function getEditableHint(el: Element) {
  return [
    el.getAttribute("placeholder"),
    el.getAttribute("data-placeholder"),
    el.getAttribute("aria-label"),
    el.getAttribute("aria-placeholder"),
    el.getAttribute("title"),
    (el.textContent ?? "").trim().slice(0, 120)
  ]
    .filter(Boolean)
    .join(" ")
}

function findTitleElement():
  | HTMLElement
  | HTMLInputElement
  | HTMLTextAreaElement
  | null {
  const directMatch = document.querySelector(
    [
      "input[placeholder*='Title' i]",
      "textarea[placeholder*='Title' i]",
      "[contenteditable='true'][data-placeholder*='Title' i]",
      "[contenteditable='true'][placeholder*='Title' i]",
      "[contenteditable='true'][aria-label*='Title' i]",
      "h1[contenteditable='true']",
      "h1"
    ].join(", ")
  )

  if (directMatch && isVisible(directMatch)) {
    return directMatch as HTMLElement | HTMLInputElement | HTMLTextAreaElement
  }

  const editables = Array.from(
    document.querySelectorAll(
      "input, textarea, h1, h1[contenteditable='true'], [contenteditable='true']"
    )
  ).filter(isVisible)

  return (
    (editables.find((el) =>
      includesHint(getEditableHint(el), ["title", "headline"])
    ) as HTMLElement | HTMLInputElement | HTMLTextAreaElement | undefined) ??
    (editables.find((el) => el.tagName === "H1") as HTMLElement | undefined) ??
    null
  )
}

function findBodyElement(titleEl?: Element | null): HTMLElement | null {
  const directMatch = document.querySelector(
    [
      ".ProseMirror[contenteditable='true']",
      "[contenteditable='true'][data-placeholder*='Start writing' i]",
      "[contenteditable='true'][aria-label*='Start writing' i]",
      "[contenteditable='true'][data-placeholder*='Write' i]",
      "[contenteditable='true'][placeholder*='Write' i]",
      "[role='textbox'][contenteditable='true']"
    ].join(", ")
  )

  if (directMatch && isVisible(directMatch) && directMatch !== titleEl) {
    return directMatch as HTMLElement
  }

  const editables = Array.from(
    document.querySelectorAll("[contenteditable='true'], [role='textbox']")
  ).filter(isVisible)

  const hinted = editables.find((el) => {
    if (el === titleEl) return false
    return includesHint(getEditableHint(el), [
      "start writing",
      "write",
      "body",
      "content",
      "tell your story"
    ])
  })

  if (hinted) return hinted as HTMLElement

  const sortedByArea = editables
    .filter((el) => el !== titleEl)
    .sort((a, b) => {
      const aRect = a.getBoundingClientRect()
      const bRect = b.getBoundingClientRect()
      return bRect.width * bRect.height - aRect.width * aRect.height
    })

  return (sortedByArea[0] as HTMLElement | undefined) ?? null
}

function fillTextLikeElement(
  el: HTMLElement | HTMLInputElement | HTMLTextAreaElement,
  value: string
) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    setNativeValue(el, value)
    return
  }

  el.focus()
  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(el)
  selection?.removeAllRanges()
  selection?.addRange(range)
  document.execCommand("insertText", false, value)
  if ((el.textContent ?? "").trim() !== value) {
    el.textContent = value
  }
  el.dispatchEvent(new Event("input", { bubbles: true }))
  el.dispatchEvent(new Event("change", { bubbles: true }))
}

function findEditableContainer(el: HTMLElement) {
  return (
    (el.closest("[contenteditable='true']") as HTMLElement | null) ??
    (el.querySelector("[contenteditable='true']") as HTMLElement | null)
  )
}

function fillTitleElement(
  el: HTMLElement | HTMLInputElement | HTMLTextAreaElement,
  value: string
) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    setNativeValue(el, value)
    return
  }

  const editableContainer = findEditableContainer(el)

  if (editableContainer) {
    fillTextLikeElement(editableContainer, value)
  }

  fillTextLikeElement(el, value)

  if ((el.textContent ?? "").trim() !== value) {
    el.textContent = value
  }

  const heading =
    el.tagName === "H1"
      ? el
      : (el.querySelector("h1") as HTMLElement | null) ?? null
  if (
    heading instanceof HTMLElement &&
    (heading.textContent ?? "").trim() !== value
  ) {
    heading.textContent = value
    heading.dispatchEvent(new Event("input", { bubbles: true }))
  }
}

async function fillEditor(): Promise<FillResult> {
  const doc = await getParsedDocument()
  if (!doc) {
    return {
      success: false,
      platformId: "substack",
      error: "No parsed document found"
    }
  }

  try {
    await waitForSelector(
      [
        ".ProseMirror",
        "[contenteditable='true']",
        "input[placeholder*='Title' i]",
        "textarea[placeholder*='Title' i]"
      ].join(", "),
      10000
    )

    const titleEl = findTitleElement()
    if (titleEl) {
      fillTitleElement(titleEl, doc.title)
    }

    const bodyEl = findBodyElement(titleEl)
    if (bodyEl) {
      const html = markdownToHtml(doc.body)
      bodyEl.focus()
      const clipboardData = new DataTransfer()
      clipboardData.setData("text/html", html)
      clipboardData.setData("text/plain", doc.body)
      const pasteEvent = new ClipboardEvent("paste", {
        clipboardData,
        bubbles: true,
        cancelable: true
      })
      bodyEl.dispatchEvent(pasteEvent)

      // Fallback if paste didn't work
      if (!bodyEl.innerHTML || bodyEl.innerHTML.length < 10) {
        insertHtmlIntoContentEditable(bodyEl, html)
      }
    }

    if (!titleEl || !bodyEl) {
      return {
        success: false,
        platformId: "substack",
        error: "Could not find Substack title or body editor"
      }
    }

    return { success: true, platformId: "substack" }
  } catch (e) {
    return {
      success: false,
      platformId: "substack",
      error: e instanceof Error ? e.message : "Failed to fill editor"
    }
  }
}

chrome.runtime.onMessage.addListener(
  (message: FillMessage, _sender, sendResponse) => {
    if (message.action === "fill-editor" && message.platformId === "substack") {
      fillEditor().then(sendResponse)
      return true
    }
  }
)
