import { ASTType, BindingState, SymbolKind, OwnershipKind } from "./types.js"
import { log } from "../helper.js"
import { ScopeStack } from "./symbols.js"

function getReturnType(symbol) {
  // log("SYMBOLD IN RETURN TYPE", symbol)
  // log("RETURN TYPE:")
  // log.stringify(symbol.node.returnType)
  if (!symbol) return
  if (!symbol.kind) return

  switch (symbol.kind) {
    case SymbolKind.FUNCTION:
    case SymbolKind.METHOD: {
      const type = symbol.node.returnType?.type

      // log("GET RETURN TYPE RAW:")
      // log.stringify(type)

      return type || null
    }
    case SymbolKind.VARIANT: {
      return { kind: ASTType.TypeReference, name: symbol.parent || null }
    }
    default:
      return
  }
}

function resolveNode(ctx, node) {
  if (!node) return

  // log.stringify(node)

  const { table: symbols, scope } = ctx
  // log("NODE: ", node)
  switch (node.kind) {
    case ASTType.VariableDeclaration: {
      resolveNode(ctx, node.init)

      scope.declare(node.name, {
        kind: SymbolKind.BINDING,
        state: BindingState.ALIVE,
        mutable: node.mutable,
        type: node.init.type ?? null,
      })

      break
    }
    case ASTType.PathExpression: {
      const symbol = symbols.resolve(node.path)
      // log("SYMBOL: ", symbol)
      // symbols.debug()
      // return
      if (!symbol) {
        throw new Error(`Could not find SYMBOL ${node.path.join("::")}`)
      }

      node.resolved = symbol

      break
    }
    case ASTType.Identifier: {
      const symbol = symbols.resolve([node.value])
      // console.log("IDENT:", node.value)
      // console.log("SYMBOL:", symbol)

      // // console.log("IDENT:", node.value)
      // // console.log("SYMBOL:", symbol)

      if (symbol) {
        node.resolved = symbol
      } else {
        const binding = scope.lookup(node.value)

        // // console.log("BINDING:", binding)

        if (!binding) {
          throw new Error(`Could not find VARIABLE ${node.value}`)
        }

        node.type = binding.type
        node.resolved = binding
      }

      break
    }
    case ASTType.StructLiteral: {
      const symbol = symbols.resolve(node.path)

      if (!symbol) {
        throw new Error(`Could not find STRUCT = ${node.path.join("::")}`)
      }

      if (symbol.kind !== SymbolKind.STRUCT) {
        throw new Error(`expected struct kind, but got: ${symbol.kind} `)
      }

      node.resolved = symbol
      node.type = {
        kind: ASTType.TypeReference,
        name: symbol.node.path.join("::"),
      }

      break
    }
    case ASTType.CallExpression: {
      // log("3", node)
      resolveNode(ctx, node.callee)
      // log("4", node.callee)

      for (let arg of node.args) resolveNode(ctx, arg.value)

      node.resolved = node.callee.resolved
      node.type = getReturnType(node.resolved)
      // log("CALL TYPE:")
      // log.stringify(node.type)

      break
    }
    case ASTType.MemberExpression: {
      resolveNode(ctx, node.object)

      const type = node.object.type

      const isTypeParam = ctx.typeParams?.find((p) => p.name === type?.name)
      if (isTypeParam) {
        node.resolved = {
          kind: SymbolKind.TYPE_PARAM_METHOD,
          typeName: type.name,
          method: node.property,
        }

        break
      }

      const symbolStruct = symbols.resolve([type.name])

      const field = symbolStruct.node.fields.find(
        (field) => field.name === node.property,
      )

      if (field) {
        node.resolved = {
          kind: SymbolKind.FIELD,
          field,
        }
      } else {
        const symbol = symbols.resolve([type.name, node.property])

        if (symbol) {
          node.resolved = symbol
        }
      }

      break
    }
    case ASTType.FunctionDeclaration: {
      scope.push()

      for (const param of node.params) {
        scope.declare(param.name, {
          kind: SymbolKind.BINDING,
          state: BindingState.ALIVE,
          mutable: param.ownership.kind === OwnershipKind.BorrowMut,
          type: param.type,
        })
      }

      for (const statement of node.body.body) {
        resolveNode(
          { ...ctx, typeParams: node.typeParameters ?? [] },
          statement,
        )
      }

      scope.pop()

      break
    }
    case ASTType.MatchExpression: {
      resolveNode(ctx, node.subject)

      for (const arm of node.arms) {
        scope.push()

        for (const binding of arm.pattern.bindings ?? []) {
          scope.declare(binding, {
            kind: SymbolKind.BINDING,
            state: BindingState.ALIVE,
            mutable: false,
            type: null,
          })
        }

        resolveNode(ctx, arm.body)

        scope.pop()
      }

      break
    }
    case ASTType.BinaryExpression: {
      resolveNode(ctx, node.left)
      resolveNode(ctx, node.right)
      break
    }
    case ASTType.AssignmentExpression: {
      resolveNode(ctx, node.left)
      resolveNode(ctx, node.right)
      break
    }
    case ASTType.ReturnStatement: {
      // console.log("RESOLVING RETURN:", node.line)
      // console.log("ARG KIND:", node.argument?.kind)
      // console.log("ARG CALLEE:", node.argument?.callee?.value)
      resolveNode(ctx, node.argument)
      break
    }
    case ASTType.IfStatement: {
      resolveNode(ctx, node.condition)
      resolveNode(ctx, node.consequent)

      if (node.alternate) {
        resolveNode(ctx, node.alternate)
      }

      break
    }
    case ASTType.BlockStatement: {
      for (let stmt of node.body || []) {
        resolveNode(ctx, stmt)
      }
      break
    }
    case ASTType.NumberLiteral:
      node.type = { kind: ASTType.TypeReference, name: "number" }
      break
    case ASTType.StringLiteral:
      node.type = { kind: ASTType.TypeReference, name: "string" }
      break
    case ASTType.BooleanLiteral:
      node.type = { kind: ASTType.TypeReference, name: "bool" }
      break
    default:
      break
  }
}

function symbolResolver(ast, context) {
  const ctx = {
    ...context,
    scope: new ScopeStack(),
  }
  // console.log("GET USER SYMBOL:", ctx.table.resolve(["getUser"]))
  // console.log("ERR SYMBOL:", ctx.table.resolve(["Err"]))

  for (let node of ast.body) {
    resolveNode(ctx, node)
  }

  // ctx.symbols.debug()
  // ctx.scope.debug()
  // log.stringify(ast)
}

export { symbolResolver }
