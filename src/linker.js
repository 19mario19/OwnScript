import { log } from "../helper.js"
import { resolvePath } from "./resolver.js"
import { ASTType } from "./types.js"

function getImports(ast) {
  return ast.body.filter((node) => node.kind === ASTType.UseStatement)
}

function linker(ast) {
  const imports = getImports(ast).map((node) => {
    const symbol = node.path[node.path.length - 1]
    const longKey = node.path.join("::")

    log.stringify(node)

    return {
      namespace: {
        symbol,
        longKey,
      },
      path: node.path,
      module: resolvePath(node.path),
      symbols: node.symbols,
    }
  })

  ast.imports = imports
  return ast
}

export { linker }
