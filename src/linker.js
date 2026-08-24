import { readFileSync, writeFileSync, mkdirSync } from "fs"
import { log } from "../helper.js"
import { pathResolver } from "./resolver.js"
import { ASTType, TokenType } from "./types.js"
import { lexer } from "./lexer.js"
import { parser } from "./parser.js"
const moduleCache = new Map()

function getModule(path) {
  if (moduleCache.has(path)) {
    return moduleCache.get(path)
  }
  const resolver = pathResolver(path)
  const file = readFileSync(resolver.source, "utf8")

  const ast = parser(lexer(file))
  const module = { ...resolver, exports: getPub(ast) }

  moduleCache.set(path, module)
  return module
}

function getPub(ast) {
  const pubStructNames = new Set(
    ast.body
      .filter((n) => n.kind === ASTType.StructDeclaration && n.pub)
      .map((n) => n.path[0]),
  )
  return ast.body.filter(
    (node) =>
      node.pub ||
      (node.kind === ASTType.ImplBlock && pubStructNames.has(node.name)),
  )
}

function getImports(ast) {
  return ast.body.filter((node) => node.kind === ASTType.UseStatement)
}

function linker(ast) {
  let imports = getImports(ast).map((node) => {
    const symbol = node.path[node.path.length - 1]
    const longKey = node.path.join("::")

    return {
      namespace: {
        symbol,
        longKey,
      },
      path: node.path,
      module: getModule(node.path),
    }
  })

  ast.imports = imports

  return ast
}

export { linker }
