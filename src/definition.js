// here we do the registring
import { log } from "../helper.js"
import { lowerFunction } from "./ir.js"
import { SymbolTable, TypeRegistry } from "./symbols.js"
import {
  ASTType,
  OwnershipKind,
  SymbolKind,
  TypeRegistryKind,
} from "./types.js"

function define(ctx, array, prefix = []) {
  const { table, types } = ctx
  for (let node of array) {
    switch (node.kind) {
      case ASTType.FunctionDeclaration: {
        const [foo, ...rest] = prefix // JUST A TEST
        log("function : ", prefix, node.name)
        table.register([node.name], { kind: SymbolKind.FUNCTION, node }, rest)
        // table.register([node.name], { kind: SymbolKind.FUNCTION, node }, prefix)

        table.debug()
        break
      }

      case ASTType.StructDeclaration: {
        table.register(node.path, { kind: SymbolKind.STRUCT, node }, prefix)
        types.register(node.path.at(-1), {
          kind: TypeRegistryKind.STRUCT,
          node,
        })

        break
      }

      case ASTType.ImplBlock: {
        let parentName = node.name
        for (let method of node.methods) {
          table.register(
            [parentName, method.name],
            {
              kind: SymbolKind.METHOD,
              node: method,
            },
            prefix,
          )
        }
        break
      }
      case ASTType.TypeDeclaration: {
        ctx.table.register([node.name], { kind: SymbolKind.TYPE, node }, prefix)
        ctx.types.register(node.name, { kind: TypeRegistryKind.ALIAS, node })

        for (let variant of node.variants) {
          // ctx.table.register([variant.name], {
          ctx.table.register([node.name, variant.name], {
            kind: SymbolKind.VARIANT,
            node: variant,
            parent: node.name,
          })
        }
        for (let variant of node.variants) {
          // ctx.table.register([node.name, variant.name], {
          ctx.table.register([variant.name], {
            kind: SymbolKind.VARIANT,
            node: variant,
            parent: node.name,
          })
        }

        // console.log(
        //   "REGISTERED VARIANTS:",
        //   node.variants.map((v) => v.name),
        // )
        // console.log("HAS OK:", ctx.table.has(["Ok"]))
        // console.log("HAS ERR:", ctx.table.has(["Err"]))
        break
      }
      default:
        continue
    }
  }
}

function defineLocal(ctx, ast) {
  define(ctx, ast.body)
}

function exportMatchesSymbol(node, symbol) {
  if (node.kind === ASTType.StructDeclaration) {
    return node.path[0] === symbol
  }

  if (node.kind === ASTType.ImplBlock) {
    return node.name === symbol
  }

  return node.name === symbol
}

function defineImport(ctx, ast) {
  for (let imp of ast.imports) {
    let [first, ...rest] = imp.path

    let exports = imp.module.exports || []
    const requested = new Set(imp.symbols)

    let prefix
    if (imp.symbols && imp.symbols.length > 0) {
      prefix = imp.symbols.length > 0 ? [] : rest
      exports = exports.filter((node) =>
        imp.symbols.some((symbol) => exportMatchesSymbol(node, symbol)),
      )
      for (const symbol of requested) {
        const found = exports.some((node) => exportMatchesSymbol(node, symbol))

        if (!found) {
          throw new Error(`${imp.path.join("::")} does not export ${symbol}.`)
        }
      }
    }

    exports = exports.map((v) => {
      if (v.methods) {
        v.methods = v.methods.map((p) => ({ ...p, imported: true }))
      }

      return { ...v, imported: true }
    })

    define(ctx, exports, prefix)
  }
}

function definitionPass(ast) {
  const ctx = {
    table: new SymbolTable(),
    types: new TypeRegistry(),
  }
  ctx.types.seed()
  ctx.types.seedTraits()

  // ctx.types.debug()

  defineImport(ctx, ast)
  defineLocal(ctx, ast)
  // ctx.types.debug()
  // ctx.table.debug()

  return ctx
}

// LOWERING PHASE

function handleParams(node) {
  if (node.self) {
    node.params.unshift({
      name: "self",
      ownership: node.self.ownership,
      type: { kind: ASTType.TypeReference, name: "Self" },
    })
  }

  return node.params.map((param, index) => {
    return {
      kind: ASTType.VariableDeclaration,
      name: param.name,
      type: param.type,
      mutable: param.ownership.kind === OwnershipKind.BorrowMut,
      ownership: param.ownership,
      index,
      isParam: true,
    }
  })
}

function lowerSymbols(context) {
  const { table: symbols } = context

  let table = symbols.get()
  for (let [name, symbol] of table) {
    let node = symbol.node
    switch (symbol.kind) {
      case SymbolKind.FUNCTION:
      case SymbolKind.METHOD: {
        let params = handleParams(node)
        node.body.body.unshift(...params)

        table.set(name, {
          ...table.get(name),
          cfg: lowerFunction(node.body.body),
        })
        break
      }
      default:
        continue
    }
  }

  return table
}

export { definitionPass, lowerSymbols }
