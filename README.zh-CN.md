<div align="center">

# Markdown Publisher

**一次编写，多平台发布。**

一个 Chrome 扩展，让你通过同一套流程，把一篇 Markdown 文章快速分发到多个平台。

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://github.com/Createitv/markdown-publisher/releases)
[![License](https://img.shields.io/github/license/Createitv/markdown-publisher?style=flat-square)](LICENSE)
[![Release](https://img.shields.io/github/v/release/Createitv/markdown-publisher?style=flat-square)](https://github.com/Createitv/markdown-publisher/releases)
[![Stars](https://img.shields.io/github/stars/Createitv/markdown-publisher?style=flat-square)](https://github.com/Createitv/markdown-publisher)

[产品介绍页](https://md-publisher.vercel.app) · [English](README.md) · [下载](https://github.com/Createitv/markdown-publisher/releases)

</div>

---

## 支持的平台

| 平台 | 类型 |
|------|------|
| **X** | 短帖（280 字符） |
| **X Articles** | 长文 |
| **dev.to** | 开发者博客 |
| **Medium** | 博客 / 文章 |
| **Reddit** | 社区帖子 |
| **Substack** | 新闻通讯 |

## 工作原理

```
 ┌──────────────┐
 │  Markdown     │
 │  (.md 文件)   │
 └──────┬───────┘
        │ 解析
        ▼
 ┌──────────────┐     ┌─────┐  ┌────────┐  ┌────────┐
 │  弹窗 UI      │────▶│  X  │  │ Medium │  │ dev.to │  ...
 │  选择频道      │     └─────┘  └────────┘  └────────┘
 └──────────────┘     自动填充标题、正文、标签
```

1. 选择要发布的频道。
2. 选择 Markdown 文件或拖入文件夹。
3. 检查自动解析的标题和标签。
4. 打开发布页面 — 内容自动填充。

## 适合什么场景

- **一文多发** — 一篇文章同时发布到多个平台
- **内容一致** — 标题和正文保持一致
- **高效发布** — 跳过反复复制粘贴
- 面向 **创作者、作者和小团队**

## 安装

从 [Releases](https://github.com/Createitv/markdown-publisher/releases) 下载最新的 `.zip` 文件，然后：

1. 在 Chrome 中打开 `chrome://extensions/`
2. 打开右上角的**开发者模式**
3. 点击**加载已解压的扩展程序**
4. 选择解压后的文件夹

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build
```

## 技术栈

- [Plasmo](https://www.plasmo.com/) — Chrome 扩展框架
- React + TypeScript
- Tailwind CSS
- 国际化（English / 中文）

## 参与贡献

欢迎贡献代码！可以直接提 Issue 或提交 Pull Request。

## 支持项目

如果这个项目对你有帮助：

- 给项目点个 **Star** 表示支持
- **分享** 给你的朋友或发到社交媒体
- 通过 [Issues](https://github.com/Createitv/markdown-publisher/issues) **反馈 Bug** 或 **建议新功能**
- **Fork & PR** — 任何大小的贡献都非常欢迎

## 许可证

MIT
