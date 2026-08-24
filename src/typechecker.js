import {
  ASTType,
  BlockKind,
  BindingState,
  OwnershipKind,
  SymbolKind,
} from "./types.js"
import { TypeError } from "./errors.js"
import { ScopeStack } from "./symbols.js"

import { log, methodToTrait } from "../helper.js"

function analyseArguments(
  ctx,
  params,
  args,
  state,
  receiver = null,
  genericBounds,
) {
  if (params.length > 0 && params[0].name === "self") {
    let self = params.shift()
  }

  // // log(genericBounds)

  // // log.stringify(ctx.typeParams)
  // // log.stringify(params)
  // // log.stringify(args)

  for (let i = 0; i < params.length; i++) {
    const param = params[i]
    const arg = args[i]

    const argNode = arg.value

    let declared = param.type
    let inferred = checkExpression(argNode, state, ctx)

    // // log("DECLARED: ", declared)
    // // log("INFERRED: ", inferred)
    // // console.log("CHECK TYPE:", {
    //   declared,
    //   inferred,
    //   node: argNode.kind,
    // })

    if (genericBounds.has(param.type.name)) {
      const { type, bounds } = genericBounds.get(param.type.name)
      declared = type

      if (bounds && bounds.length > 0) {
        let missing = []
        for (let bound of bounds) {
          if (!ctx.types.implements(type.name, bound)) missing.push(bound)
        }

        if (missing.length > 0) {
          throw new Error(
            `"${type.name}" type does not implement traits [${missing.join(", ")}]`,
          )
        }
      }
    }
    argNode.type = declared ?? inferred

    checkType(declared, inferred, argNode, ctx)
  }
}

function checkStatements(ctx, statements, state = new ScopeStack()) {
  for (let stmt of statements) {
    // // log(stmt.kind)
    switch (stmt.kind) {
      case ASTType.VariableDeclaration: {
        if (stmt.isParam) {
          state.declare(stmt.name, { type: stmt.type })
          continue
        }
        let declaredType = stmt.type

        // // log(stmt)

        if (stmt.iterable) {
          declaredType = checkExpression(stmt.iterable, state, ctx).element
          state.declare(stmt.name, { type: declaredType })
          continue
        }

        if (stmt.init) {
          let inferredType = checkExpression(
            stmt.init,
            state,
            ctx,
            declaredType,
          )

          // checkStatements(ctx, [stmt.init], state)
          checkType(declaredType, inferredType, stmt, ctx)
          // // log("inferredType: ", inferredType)
          // // log("declaredType: ", declaredType)

          state.declare(stmt.name, { type: inferredType ?? declaredType })
        }
        break
      }
      case ASTType.ReturnStatement: {
        checkExpression(stmt, state, ctx)
        break
      }
      case ASTType.AssignmentExpression: {
        let left = checkExpression(stmt.left, state, ctx)
        let right = checkExpression(stmt.right, state, ctx)

        checkType(left, right, stmt, ctx)

        break
      }
      case ASTType.CallExpression: {
        checkExpression(stmt, state, ctx)
        break
      }

      default:
        continue
    }
  }

  return state
}

function visit(
  ctx,
  blocks,
  blockId,
  state = new ScopeStack(),
  visited = new Set(),
  stopAt = null,
) {
  if (!blocks[blockId]) return state
  if (visited.has(blockId)) return state
  if (blockId === stopAt) return state

  visited.add(blockId)

  const block = blocks[blockId]

  if (block.kind === BlockKind.BasicBlock) {
    state = checkStatements(ctx, block.statements, state)
    return visit(ctx, blocks, block.next, state, visited, stopAt)
  }

  if (block.kind === BlockKind.BranchBlock) {
    const join = findJoin(blocks, block.consequent)
    const joinId = join?.id ?? null

    const stateA = visit(
      ctx,
      blocks,
      block.consequent,
      state.clone(),
      new Set(visited),
      joinId,
    )

    const stateB = visit(
      ctx,
      blocks,
      block.alternate,
      state.clone(),
      new Set(visited),
      joinId,
    )

    const merged = merge(stateA, stateB)

    if (joinId) return visit(ctx, blocks, joinId, merged, visited)

    return merged
  }

  return state
}

function merge(a, b) {
  const merged = new ScopeStack()

  for (const [name, typeA] of a.get()[0].entries()) {
    if (!typeA?.type) continue
    const typeB = b.get(name)[0]
    if (!typeB?.type) continue

    if (!typeB || typeB.size === 0) continue

    if (
      typeA.type.kind !== typeB.type.kind ||
      typeA.type.name !== typeB.type.name
    ) {
      throw new TypeError(`branch type mismatch for '${name}'`)
    }

    merged.set(name, typeA)
  }

  return merged
}

function findJoin(blocks, blockId) {
  let current = blocks[blockId]

  while (current) {
    if (current.predecessors?.length > 1) return current
    current = blocks[current.next]
  }

  return null
}

function analyseFields(structFields, literalFields, state, ctx) {
  // if (structFields.length !== literalFields.length)
  //   throw new Error(`Wrong type!`)
  for (let i = 0; i <= structFields.length - 1; i++) {
    let item = structFields[i]
    let literal = literalFields[i]

    let itemType = item.type
    let literalType = checkExpression(literal.value, state, ctx)
    checkType(itemType, literalType, literal, ctx)
  }
}

const BINARY_OP = {
  // Arithmetic
  "+": "Add",
  "-": "Sub",
  "*": "Mul",
  "/": "Div",
  "%": "Rem",

  // Bitwise
  "&": "BitAnd",
  "|": "BitOr",
  "^": "BitXor",
  "<<": "Shl",
  ">>": "Shr",

  // Equality
  "==": "PartialEq",
  "!=": "PartialEq",

  // Relational
  "<": "PartialOrd",
  "<=": "PartialOrd",
  ">": "PartialOrd",
  ">=": "PartialOrd",

  // Compound Assignment
  "+=": "AddAssign",
  "-=": "SubAssign",
  "*=": "MulAssign",
  "/=": "DivAssign",
  "%=": "RemAssign",
  "&=": "BitAndAssign",
  "|=": "BitOrAssign",
  "^=": "BitXorAssign",
  "<<=": "ShlAssign",
  ">>=": "ShrAssign",
}

// leaf node, returns only the type, does not validate
function inferType(node, state, ctx) {
  // log("INFER TYPE: ", node)
  switch (node.kind) {
    case ASTType.NumberLiteral:
      return { kind: ASTType.TypeReference, name: "number" }
    case ASTType.StringLiteral:
      return { kind: ASTType.TypeReference, name: "string" }
    case ASTType.BooleanLiteral:
      return { kind: ASTType.TypeReference, name: "bool" }
    case ASTType.Identifier:
      return state.lookup(node.value)?.type ?? null

    default:
      throw new Error("unhandled node kind: " + node.kind)
  }
}

// recurse into expression, validate the whole subtree
function checkExpression(node, state, ctx, expectedType) {
  switch (node.kind) {
    case ASTType.ReturnStatement: {
      const inferred = checkExpression(node.argument, state, ctx)

      if (ctx.currentFunction?.returnType) {
        const declared = ctx.currentFunction.returnType.type
        checkType(declared, inferred, node, ctx)
      }

      return inferred
    }
    case ASTType.StructLiteral: {
      // log(node.path)
      // log("HERE", ctx.table.resolve(["http", "Client"]))
      // log("PATH: ", node.path)
      // ctx.table.debug()
      const struct = ctx.table.resolve(node.path)
      // log("struct: ", struct)

      analyseFields(struct.node.fields, node.fields, state, ctx)

      return { kind: ASTType.TypeReference, name: node.name }
    }
    case ASTType.BinaryExpression: {
      // log(node)
      const left = checkExpression(node.left, state, ctx)
      const right = checkExpression(node.right, state, ctx)

      // log("left: ", left)
      // log("right: ", right)

      if (left.name !== right.name) {
        throw new Error(
          `Both types must be the same but got ${left.name} and ${right.name}`,
        )
      }

      const requiredTrait = BINARY_OP[node.op]
      if (!requiredTrait) break // check supported ones only

      for (let type of [left, right]) {
        if (!type) continue
        //is generic
        const typeParam = ctx.typeParams.find(
          (param) => param.name === type.name,
        )
        if (typeParam) {
          if (!typeParam.bounds.includes(requiredTrait)) {
            throw new Error(
              `OP "${node.op}" requires ${requiredTrait} on ${type.name}`,
            )
          }
        } else {
          if (!ctx.types.implements(type.name, requiredTrait)) {
            throw new Error(
              `OP "${node.op}" not supported for type ${type.name}`,
            )
          }
        }
      }

      return left
    }
    case ASTType.CallExpression: {
      const resolved = node.resolved
      // console.log("CALLEE:", node.callee)
      // console.log("RESOLVED:", node.resolved)
      if (!resolved) return null

      /**
       * GENERIC METHOD ON TYPE
       * fn foo<T: Clone>(bar: T) -> T {
       *  return bar.clone()
       * }
       */
      if (resolved.kind === SymbolKind.TYPE_PARAM_METHOD) {
        const { typeName, method } = resolved
        // type must have trait implemented, included in its bounds

        const genricType = ctx.typeParams.find((p) => p.name === typeName)
        if (!genricType) {
          throw new Error(`$${genricType} was not found in type params.`)
        }

        if (!genricType.bounds.includes(methodToTrait[method])) {
          throw new Error(
            `Could not find the trait ${methodToTrait[method]} on ${typeName}`,
          )
        }
        return {
          kind: ASTType.TypeReference,
          name: typeName,
        }
      } else if (resolved.kind === SymbolKind.VARIANT) {
        const actuals = node.args.map((arg) =>
          checkExpression(arg.value, state, ctx),
        )

        const parent = ctx.types.resolve({
          kind: ASTType.TypeReference,
          name: resolved.parent,
        })

        const typeArgs = parent.node.typeParameters.map(() => null)

        for (let i = 0; i < resolved.node.params.length; i++) {
          const param = resolved.node.params[i]
          const index = parent.node.typeParameters.findIndex(
            (typeParam) => typeParam.name === param,
          )

          if (index === -1) continue

          typeArgs[index] = actuals[i]
        }

        const inferred = {
          kind: ASTType.TypeReference,
          name: resolved.parent,
          type: typeArgs,
        }

        const declared = ctx.currentFunction?.returnType?.type

        if (declared) {
          checkType(declared, inferred, node, ctx)
        }

        return inferred
      }

      // ARGS
      // !!! args also could be variants
      // log("resolved: ", resolved)
      const params = resolved.node.params
      // if (!params) return

      const genericBounds = new Map()
      for (let i = 0; i < params.length; i++) {
        let param = resolved.node.params[i]
        let arg = node.args[i]

        let inferred = checkExpression(arg.value, state, ctx)

        const explicit = node.typeArgs?.[i]

        const typeParam = resolved.node.typeParameters?.find(
          (t) => t.name === param.type.name,
        )

        if (typeParam) {
          genericBounds.set(param.type.name, {
            type: explicit ?? arg.value.type ?? inferred,
            bounds: typeParam.bounds,
          })
        }
      }

      analyseArguments(
        ctx,
        resolved.node.params,
        node.args,
        state,
        null, // receiver
        genericBounds,
      )

      return resolved.node?.returnType?.type ?? null
    }
    case ASTType.MatchExpression: {
      const subjectType = checkExpression(node.subject, state, ctx)
      // log(subjectType)
      const resolved = ctx.types.resolve(subjectType)

      if (!resolved) {
        throw new TypeError(`Could not resolve match subject type`, {
          line: node.line,
          source: ctx.source,
        })
      }

      const hasWildcard = node.arms.some(
        (a) => a.pattern.kind === ASTType.WildcardPattern,
      )

      if (!hasWildcard) {
        const variants = resolved.node.variants.map((v) => v.name).sort()
        const arms = node.arms
          .map((a) => a.pattern.name.split("::").at(-1))
          .sort()

        // log("variants: ", variants)
        // log("arms: ", arms)

        for (let i = 0; i < variants.length; i++) {
          if (variants[i] !== arms[i]) {
            throw new Error(
              `Variants [${variants.join(", ")}] expected. But got [${arms.join(", ")}]`,
            )
          }
        }
      }

      const armTypes = []

      // walk arms
      for (let arm of node.arms) {
        const armState = state.clone() // isolated state for each arm
        armState.push()
        // Find the variant of arm in resolved

        if (arm.pattern.kind === ASTType.VariantPattern) {
          const variant = resolved.node.variants.find(
            (v) => v.name === arm.pattern.name.split("::").at(-1),
          )

          if (!variant) {
            throw new Error(
              `Could not find variant ${arm.pattern.name} in ${resolved.node.name}`,
            )
          }

          // substitution T => string , E => bool
          const substitution = new Map()
          for (let i = 0; i < resolved.node.typeParameters.length; i++) {
            const actual = subjectType.type[i]

            if (actual) {
              substitution.set(
                resolved.node.typeParameters[i].name,
                actual.name,
              )
            }
          }

          // add binding with concrete type in a new scope
          for (let i = 0; i < arm.pattern.bindings.length; i++) {
            const binding = arm.pattern.bindings[i]
            const variantParam = variant.params[i]

            let bindingType = variantParam

            // if it is generic, currently flat ones, not nested
            // T , E, WhateverGenericType
            // no Vec<T>, Foo<T<U>>
            if (typeof bindingType === "string") {
              bindingType = substitution.get(bindingType) ?? bindingType
            }

            // adding the binding with its type to the new scope
            armState.declare(binding, {
              type: { kind: ASTType.TypeReference, name: bindingType },
            })
          }
        }

        const armType = checkExpression(arm.body, armState, ctx)

        armTypes.push(armType)
      }

      // log("armTypes: ", armTypes)

      // we will handle Never later, it will be a subtype of every other type.
      // never x whatever is always whatever. never x never = never.

      // for now first version. What if the first is Never? All this won't work.
      // Known limitation. To be fixed!
      const matchedType = armTypes[0]
      if (!matchedType) {
        throw new Error(`Matched type must exist.`)
      }

      for (let i = 0; i < armTypes.length; i++) {
        const armType = armTypes[i]

        if (!armType) {
          throw new Error("All arms must return a type")
        }

        checkType(matchedType, armType, node, ctx)
      }

      return matchedType
    }
    case ASTType.ArrayExpression: {
      if (!expectedType) {
        // No declared array type to check against — element-level inference
        // from the literal alone is out of scope for now (see: array element
        // type inference, deferred). Elements are unchecked in this case.
        return null
      }
      for (let element of node.elements) {
        let elementType = checkExpression(element, state, ctx)

        checkType(expectedType.element, elementType, node, ctx)
      }

      return expectedType
    }
    case ASTType.ClosureExpression: {
      return null
    }
    case ASTType.BlockStatement: {
      const blockState = state.clone()

      let resultType = null

      for (const stmt of node.body) {
        if (stmt.kind === ASTType.ReturnStatement) {
          resultType = checkExpression(stmt, blockState, ctx)
          continue
        }

        // statements that don't produce a value
        checkStatements(ctx, [stmt], blockState)
      }

      // log("result type: ", resultType)

      return resultType
    }
    case ASTType.PathExpression: {
      const resolved = node.resolved

      if (!resolved) {
        throw new TypeError(`Could not resolve path ${node.path.join("::")}`, {
          line: node.line,
          source: ctx.source,
        })
      }

      return resolved
    }
    default:
      return inferType(node, state, ctx)
  }
}

function checkType(declared, inferred, node, ctx) {
  if (!declared || !inferred) return

  if (declared.kind !== inferred.kind) {
    throw new TypeError(
      `Kind mismatch expected ${declared.kind} but got ${inferred.kind}`,
      {
        line: node.line,
        source: ctx.source,
      },
    )
  }

  if (
    declared.kind === ASTType.TypeReference &&
    declared.name !== inferred.name
  ) {
    throw new TypeError(`expected ${declared.name} but got ${inferred.name}`, {
      line: node.line,
      source: ctx.source,
    })
  }

  if (declared.type && inferred.type) {
    for (let i = 0; i < declared.type.length; i++) {
      if (!declared.type[i] || !inferred.type[i]) continue

      checkType(declared.type[i], inferred.type[i], node, ctx)
    }
  }
}

function typeCheck(context, source) {
  const ctx = { source, ...context }

  let table = ctx.table.get()

  for (let [key, entry] of table) {
    if (entry.node?.imported) continue
    if (entry.kind === SymbolKind.STRUCT) continue
    if (!entry.cfg) continue

    const state = new ScopeStack()

    visit(
      {
        ...ctx,
        currentFunction: entry.node,
        typeParams: entry.node.typeParameters ?? [],
      },
      entry.cfg.blocks,
      entry.cfg.entryId,
      state,
    )
  }
}

export { typeCheck }
