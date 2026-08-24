import { fileURLToPath } from "url"
import { dirname } from "path"
import path from "path"
import { log } from "../helper.js"
import fs from "fs"

const __dirname = dirname(fileURLToPath(import.meta.url))

function resolveModule(basePath, segments) {
  // a, b, c -> a/b/c.own or a/b/c/mod.own
  const filePath = path.join(basePath, ...segments) + ".own"
  if (fs.existsSync(filePath)) return filePath

  const modPath = path.join(basePath, ...segments, "mod.own")
  if (fs.existsSync(modPath)) return modPath

  throw new Error(`Segments ${segments.join("::")} not found.`)
}

function resolveStd(srcPath) {
  let [kind, ...rest] = srcPath

  let joined = path.join(__dirname, "/", srcPath.join("/"))

  let source = resolveModule(__dirname, srcPath)
  let emit = `file://${source.replace(".own", ".js")}`

  return {
    kind,
    source,
    emit,
  }
}
function resolvePkg(srcPath) {
  let [kind, ...rest] = srcPath

  let joined = path.join(__dirname, "/", srcPath.join("/"))

  let source = resolveModule(__dirname, srcPath)
  let emit = `file://${source.replace(".own", ".js")}`

  return {
    kind,
    source,
    emit,
  }
}
function resolveUser(srcPath) {
  let [kind, ...rest] = srcPath
  let basePath = path.join(process.cwd(), "src")
  let source = resolveModule(basePath, srcPath)
  let emit = path.join(process.cwd(), "dist", ...srcPath) + ".js"
  return { kind, source, emit }
}

function pathResolver(srcPath) {
  switch (srcPath[0]) {
    case "std":
      return resolveStd(srcPath)
    case "pkg":
      return resolvePkg(srcPath)
    default:
      return resolveUser(srcPath)
  }
}
export { pathResolver }
