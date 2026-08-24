import { ASTType } from "./types.js"

function lowerNode(node) {
  if (node.pub) {
    const { pub, ...declaration } = node

    return {
      kind: ASTType.ExportDeclaration,
      declaration,
    }
  }

  return node
}

function lowerExport(ast) {
  ast.body = [...ast.body.map((node) => lowerNode(node))]
}

export { lowerExport }
