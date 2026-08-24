import { ASTType, SymbolKind } from "./types.js"
import { log } from "../helper.js"

function visit(ctx, cb) {
  const { node } = ctx
  if (!node) return

  //   if (node.kind) {
  //     cb(node)
  //   }

  for (let prop in node) {
    if (prop === "resolved") continue
    if (typeof node[prop] === "object") {
      if (node[prop] instanceof Array) {
        for (let p of node[prop]) {
          visit({ ...ctx, node: p }, cb)
        }
      } else {
        visit({ ...ctx, node: node[prop] }, cb)
      }
    }
  }
  if (node.kind) {
    cb(node)
  }
}

function mangleName(name, typeParams) {
  return [name, ...typeParams].join("__")
}

// fn replace(&mut ast: Node, &generic: string, &concrete: TypeName) -> ()
function replace(ast, generic, concrete) {
  visit({ node: ast }, (node) => {
    if (node.type && node.type?.name && node.type.name === generic) {
      node.type = concrete
    }
  })
}

function monomorphize(context, ast) {
  const { table, types } = context

  const cache = new Map()

  visit({ node: ast }, (node) => {
    if (
      node.kind === ASTType.CallExpression &&
      node.resolved?.node?.typeParameters?.length > 0
    ) {
      const resolved = node.resolved.node
      const bindingMap = new Map()

      // Explicit generic arguments:
      // foo::<number, string, bool>(...)
      if (node.typeArgs?.length) {
        for (let i = 0; i < resolved.typeParameters.length; i++) {
          bindingMap.set(resolved.typeParameters[i].name, node.typeArgs[i])
        }
      }

      // Implicit generic inference:
      // foo(42, "hello")
      else {
        for (let i = 0; i < resolved.params.length; i++) {
          const param = resolved.params[i]
          const arg = node.args[i]

          if (!arg) continue

          const isTypeParam = resolved.typeParameters.find(
            (t) => t.name === param.type.name,
          )

          if (!isTypeParam) continue

          bindingMap.set(isTypeParam.name, arg.value.type)
        }
      }

      const concreteTypes = resolved.typeParameters.map((typeParam) =>
        bindingMap.get(typeParam.name),
      )

      const mangledName = mangleName(
        node.callee.value,
        concreteTypes.map((type) => type.name),
      )

      const cashed = cache.get(mangledName)

      if (!cashed) {
        const clone = structuredClone(resolved)

        for (let [generic, concrete] of bindingMap) {
          replace(clone, generic, concrete)
        }

        clone.typeParameters = []
        clone.name = mangledName

        cache.set(mangledName, clone)

        context.table.register([mangledName], {
          kind: SymbolKind.FUNCTION,
          node: clone,
        })

        node.resolved = context.table.resolve([mangledName])

        if (node.resolved.node?.returnType?.type) {
          node.type = node.resolved.node.returnType.type
        }
      }

      node.callee.value = mangledName
    }
  })

  return cache.values()
}

export { monomorphize }
