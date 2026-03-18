import { createRequire } from "module"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const require = createRequire(import.meta.url)
const sharp = require("sharp")

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const assetsDir = join(root, "assets")
const sizes = [16, 32, 48, 64, 128]

const variants = [
  { name: "active", svg: join(assetsDir, "icon-active.svg") },
  { name: "inactive", svg: join(assetsDir, "icon-inactive.svg") }
]

async function generate() {
  for (const variant of variants) {
    const svgBuffer = readFileSync(variant.svg)

    for (const size of sizes) {
      const outPath = join(assetsDir, `icon-${variant.name}-${size}.png`)
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outPath)
      console.log(`Generated: ${outPath}`)
    }
  }
}

generate().catch(console.error)
