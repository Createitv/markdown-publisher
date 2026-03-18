<div align="center">

# Markdown Publisher

**Write once, publish everywhere.**

A Chrome extension for publishing one Markdown article to multiple platforms from a single workflow.

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://github.com/Createitv/markdown-publisher/releases)
[![License](https://img.shields.io/github/license/Createitv/markdown-publisher?style=flat-square)](LICENSE)
[![Release](https://img.shields.io/github/v/release/Createitv/markdown-publisher?style=flat-square)](https://github.com/Createitv/markdown-publisher/releases)

[Landing Page](https://md-publisher.vercel.app) · [中文说明](README.zh-CN.md) · [Download](https://github.com/Createitv/markdown-publisher/releases)

</div>

---

## Supported Platforms

| Platform | Type |
|----------|------|
| **X** | Short post (280 chars) |
| **X Articles** | Long-form article |
| **dev.to** | Developer blog |
| **Medium** | Blog / essay |
| **Reddit** | Community post |
| **Substack** | Newsletter |

## How It Works

```
 ┌──────────────┐
 │  Markdown     │
 │  (.md file)   │
 └──────┬───────┘
        │ parse
        ▼
 ┌──────────────┐     ┌─────┐  ┌────────┐  ┌────────┐
 │  Popup UI     │────▶│  X  │  │ Medium │  │ dev.to │  ...
 │  select       │     └─────┘  └────────┘  └────────┘
 │  channels     │     auto-fill title, body, tags
 └──────────────┘
```

1. Choose the channels you want to publish to.
2. Select a Markdown file or drag a folder.
3. Review the parsed title and tags.
4. Open the publishing pages — content is filled automatically.

## Use Cases

- **Cross-posting** one article to multiple platforms at once
- **Consistency** — same title and body everywhere
- **Speed** — skip the copy-paste-format cycle
- Built for **creators, writers, and small teams**

## Install

Download the latest `.zip` from [Releases](https://github.com/Createitv/markdown-publisher/releases), then:

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the unzipped folder

## Development

```bash
# install dependencies
pnpm install

# start dev server
pnpm dev

# build for production
pnpm build
```

## Tech Stack

- [Plasmo](https://www.plasmo.com/) — Chrome extension framework
- React + TypeScript
- Tailwind CSS
- i18n (English / 中文)

## License

MIT
