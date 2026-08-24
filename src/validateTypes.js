import { log } from "../helper.js"
import { SymbolKind } from "./types.js"

function handleSymbol(ctx, symbols) {
  const { types } = ctx
  const [name, symbol] = symbols

  switch (symbol.kind) {
    case SymbolKind.FUNCTION: {
      const node = symbol.node
      types.push(node.typeParameters)

      for (let param of node.params) {
        if (param.type) {
          if (!types.isValidType(param.type.name)) {
            throw new Error(
              `Unknown type '${param.type.name}' in function '${node.name}'`,
            )
          }
        }
      }

      for (let param of node.typeParameters) {
        // log(param)
        for (let bound of param.bounds) {
          if (!ctx.types.hasTrait(bound)) {
            throw new Error(
              `Unknow trait "${bound}" on type parameter "${param.name}"`,
            )
          }
        }
      }

      if (node.returnType) {
        const retName = node.returnType.type.name
        if (!types.isValidType(retName)) {
          throw new Error(
            `Unknown type '${retName}' in function '${node.name}'`,
          )
        }
      }

      types.pop()
      break
    }
    case SymbolKind.STRUCT: {
      const node = symbol.node
      types.push(node.typeParameters)

      for (let field of node.fields) {
        if (field.type) {
          if (!types.isValidType(field.type.name)) {
            throw new Error(
              `Unknown type '${field.type.name}' in struct '${node.path.join("::")}'`,
            )
          }
        }
      }

      types.pop()
      break
    }
    default:
      break
  }
}

function validateTypes(ctx) {
  //   ctx.table.debug()
  //   ctx.types.debug()
  for (let symbol of ctx.table.get()) {
    handleSymbol(ctx, symbol)
  }
}

export { validateTypes }
