import matter from "gray-matter"

import type { ParsedDocument } from "./types"

/**
 * Extract the first H1 heading from markdown body.
 * Matches lines like: `# My Title`
 */
function extractFirstHeading(md: string): { title: string; body: string } {
  const match = md.match(/^#\s+(.+)$/m)
  if (!match) return { title: "", body: md }

  // Remove the heading line from body
  const body = md.replace(match[0], "").trim()
  return { title: match[1].trim(), body }
}

/**
 * Parse tags from frontmatter value.
 * Supports:
 *   - YAML array:    tags: [javascript, react]
 *   - Comma:         tags: javascript, react
 *   - Space:         tags: javascript react
 *   - Hash:          tags: #javascript #react
 *   - Semicolon:     tags: javascript; react
 */
function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t).replace(/^#/, "").trim()).filter(Boolean)
  }
  if (typeof raw === "string") {
    // Detect delimiter: comma > semicolon > hash-prefixed > space
    let parts: string[]
    if (raw.includes(",")) {
      parts = raw.split(",")
    } else if (raw.includes(";")) {
      parts = raw.split(";")
    } else if (raw.includes("#")) {
      parts = raw.split("#")
    } else {
      parts = raw.split(/\s+/)
    }
    return parts.map((t) => t.replace(/^#/, "").trim()).filter(Boolean)
  }
  return []
}

export function parseMarkdown(raw: string): ParsedDocument {
  const { data, content } = matter(raw)

  const description = (data.description as string) || ""
  const tags = parseTags(data.tags)

  // Title priority: frontmatter > first H1 heading in body
  const frontmatterTitle = (data.title as string) || ""
  const { title: headingTitle, body: bodyWithoutHeading } = extractFirstHeading(content.trim())

  const title = frontmatterTitle || headingTitle
  // If title came from H1, remove it from body to avoid duplication
  const body = frontmatterTitle ? content.trim() : bodyWithoutHeading

  return {
    title,
    tags,
    selectedTags: [...tags],
    description,
    body,
    rawMarkdown: raw
  }
}
