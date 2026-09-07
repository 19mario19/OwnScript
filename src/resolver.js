import { fileURLToPath } from "url"
import { dirname } from "path"
import path from "path"
import fs from "fs"
import { log } from "../helper.js"
// PARSING
import { lexer } from "./lexer.js"
import { parser } from "./parser.js"
import { ASTType } from "./types.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const cwd = process.cwd()

/**
 * RESOLVE MODULE FILE
 * foo.own
 * foo/mod.own
 *
 * 1. if one exists return
 * 2. if both exists throw
 * 3. if neither exist throw
 *
 * full path of the parent + name
 *
 */
function resolveModuleFile(parentDirectory, name) {
  const fileModule = path.join(parentDirectory, name + ".own")
  const modModule = path.join(parentDirectory, `${name}/mod.own`)

  const fileExists = fs.existsSync(fileModule)
  const modExists = fs.existsSync(modModule)

  if (fileExists && modExists) {
    throw new Error(
      `Ambiguous module resolution. Found both ${name}.own and ${name}/mod.own`,
    )
  }

  if (fileExists)
    return { name, source: fileModule, directory: path.dirname(fileModule) }
  if (modExists)
    return { name, source: modModule, directory: path.dirname(modModule) }

  throw new Error(`Module not found. Did not find module ${name}.`)
}


const moduleCache = new Map()

function loadModule(module) {
  if (moduleCache.has(module.source)) {
    return moduleCache.get(module.source)
  }

  const file = fs.readFileSync(module.source, "utf8")
  const ast = parser(lexer(file))

  const loaded = {
    ...module,
    ast,
    exports: getExports(ast),
  }

  moduleCache.set(module.source, loaded)

  resolveChildren(loaded)

  return loaded
}

function getExports(ast) {
  const pubStructNames = new Set(
    ast.body
      .filter((n) => n.kind === ASTType.StructDeclaration && n.pub)
      .map((n) => n.path[0]),
  )

  return ast.body.filter(
    (node) =>
      (node.pub && node.kind !== ASTType.ModDeclaration) ||
      (node.kind === ASTType.ImplBlock && pubStructNames.has(node.name)),
  )
}

function getModDeclarations(ast) {
  return ast.body.filter((node) => node.kind === ASTType.ModDeclaration)
}

function resolveChildren(module) {
  const declarations = getModDeclarations(module.ast)

  const children = declarations.map((node) => {
    const child = resolveModuleFile(module.directory, node.name)
    const loadedChild = loadModule(child)

    loadedChild.pub = node.pub === true

    return loadedChild
  })

  module.children = children

  return module
}

function resolveRoot(name) {
  switch (name) {
    case "std":
    case "pkg":
      return __dirname

    default:
      return path.join(process.cwd(), "src")
  }
}


function resolvePath(segments = []) {
  if (segments.length === 0) {
    throw new Error(`Cannot resolve a path with zero segments.`)
  }
  const root = segments[0]
  const resolvedRoot = resolveRoot(root)
  let module = resolveModuleFile(resolvedRoot, root)

  module = loadModule(module)

  for (let i = 1; i < segments.length; i++) {
    const name = segments[i]
    const isLast = i === segments.length - 1

    if (isLast) {
      const exported = module.exports.find((node) => {
        let res = node.name === name
        if (node.path && node.path.length > 0) {
          res = node.path[0] === name // checking struct 
        }

        return res
      })
      const child = module.children.find((child) => child.name === name)

      if ((exported && !exported.pub) || (child && !child.pub)) {
        throw new Error(`${name} is not pub.`)
      }

      if (exported && child) {
        throw new Error(
          `Ambiguous name: ${name} [exported and submodule]. \nDir: ${module.directory}\n`,
        )
      }

      if (exported) return exported
      if (child) return child

      throw new Error(`Could not resolve ${segments.join("::")}`)
    }

    const child = module.children.find((child) => child.name === name)
    // log("child: ", child.pub, child.name)

    if (!child) {
      throw new Error(
        `Could not resolve module [${segments.slice(0, i + 1).join("::")}]`,
      )
    }
    if (!child.pub) {
      throw new Error(`${name} is not pub.`)
    }

    module = child
  }

  return module
}



export { resolvePath }
