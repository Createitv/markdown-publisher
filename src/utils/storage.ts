import { Storage } from "@plasmohq/storage"

import type { ParsedDocument, PlatformId } from "./types"

const storage = new Storage({ area: "local" })

const DOC_KEY = "parsedDocument"
const PLATFORMS_KEY = "selectedPlatforms"
const SUBREDDIT_KEY = "subreddit"

export async function saveParsedDocument(doc: ParsedDocument): Promise<void> {
  await storage.set(DOC_KEY, doc)
}

export async function getParsedDocument(): Promise<ParsedDocument | null> {
  return await storage.get<ParsedDocument>(DOC_KEY)
}

export async function clearParsedDocument(): Promise<void> {
  await storage.remove(DOC_KEY)
}

export async function saveSelectedPlatforms(ids: PlatformId[]): Promise<void> {
  await storage.set(PLATFORMS_KEY, ids)
}

export async function getSelectedPlatforms(): Promise<PlatformId[]> {
  return (await storage.get<PlatformId[]>(PLATFORMS_KEY)) ?? []
}

export async function saveSubreddit(sub: string): Promise<void> {
  await storage.set(SUBREDDIT_KEY, sub)
}

export async function getSubreddit(): Promise<string> {
  return (await storage.get<string>(SUBREDDIT_KEY)) ?? ""
}
