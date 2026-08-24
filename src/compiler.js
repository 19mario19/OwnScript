import { lexer } from "./lexer.js"
import { parser } from "./parser.js"
import { codegen } from "./codegen.js"
import { log } from "../helper.js"
import { lowerMain } from "./ir.js"
import { analyze } from "./semantics.js"
import { linker } from "./linker.js"
import { typeCheck } from "./typechecker.js"
import { definitionPass, lowerSymbols } from "./definition.js"
import { symbolResolver } from "./symbolResolver.js"
import { lowerExport } from "./lowerExports.js"
import { validateTypes } from "./validateTypes.js"
import { monomorphize } from "./monomorphizer.js"

function prependAst(node, nodes) {
  node.body = [...nodes, ...node.body]
}

export function compile(source, options = {}, fileName) {
  const tokens = lexer(source)
  if (options.tokens) log.stringify("TOKENS: ", tokens)

  // const ast = parser(tokens, source)
  let ast
  ast = parser(tokens, source)
  try {
  } catch (err) {
    console.error(err.toString())
    process.exit(1)
  }
  if (options.ast) log.stringify("AST: ", ast)

  linker(ast)
  // if (options.linked) log.stringify("Linked AST: ", ast)

  let ctx = definitionPass(ast)

  validateTypes(ctx)

  symbolResolver(ast, ctx)

  lowerSymbols(ctx)
  lowerMain(ast, ctx)

  // log.stringify(ast)

  // if (options.resolved) log.stringify("Resolved AST: ", ast)
  // if (options.ast) log.stringify("AST: ", ast)

  if (options.cfg) log.stringify("CFG: ", ctx.table.get())

  try {
  } catch (err) {
    console.error(err.toString())
    process.exit(1)
  }
  analyze(ctx, source)
  typeCheck(ctx, source)

  // MONOMORPHIZATION
  const monomorphized = monomorphize(ctx, ast)
  prependAst(ast, Array.from(monomorphized))
  // if (options.ast) log.stringify("AST: ", ast)

  lowerExport(ast)
  let code = codegen(ast, fileName)

  if (options.code) log.stringify("CODE: ", code)

  return code
}
