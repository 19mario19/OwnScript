import { readFileSync, writeFileSync, mkdirSync } from "fs"
import { compile } from "./src/compiler.js"
import path from "path"
import { log } from "./helper.js"

const file = process.argv[2]

if (!file) {
  console.error(
    "Usage: node cli.js <file.own> [--tokens] [--ast] [--cfg] [--code] [--debug]",
  )
  process.exit(1)
}

const options = {
  tokens: process.argv.includes("--tokens"),
  ast: process.argv.includes("--ast"),
  cfg: process.argv.includes("--cfg"),
  code: process.argv.includes("--code"),
  linked: process.argv.includes("--linked"),
  resolved: process.argv.includes("--resolved"),
  debug: process.argv.includes("--debug"),
}

// log(process.argv)

let same = process.argv.includes("--source") // same path as source

if (options.debug) {
  options.tokens = true
  options.ast = true
  options.cfg = true
  options.code = true
  options.linked = true
}

let fileName = path.parse(file).name

const source = readFileSync(file, "utf8")
let code
try {
  code = compile(source, options, fileName)
} catch (err) {
  console.log(err)
}

mkdirSync("dist", { recursive: true })
let { dir, name } = path.parse(file)
const outFile = !same
  ? path.join("dist", path.basename(file, ".own") + ".js")
  : path.join(dir, name + ".js")

writeFileSync(outFile, code)
console.log(`compiled to -> ${outFile}`)
