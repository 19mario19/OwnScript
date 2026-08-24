import {
  ASTType,
  BlockKind,
  BindingState,
  OwnershipKind,
  SymbolKind,
} from "./types.js"
import {
  ReferenceError,
  OwnershipError,
  MutabilityError,
  UseAfterMoveError,
} from "./errors.js"

import { ScopeStack } from "./symbols.js"
import { log } from "../helper.js"

function checkIdentifier(ctx, node, state) {
  if (node.kind !== ASTType.Identifier) return

  const binding = state.lookup(node.value) // it already throws in symbol resolve
  // redundant error
  if (!binding) {
    throw new ReferenceError(`'${node.value}' not available in this scope`, {
      line: node.line,
      source: ctx.source,
    })
  }

  if (binding.state !== BindingState.ALIVE) {
    throw new OwnershipError(
      `'${node.value}' state is [${binding.state}] but requires [ALIVE]`,
      {
        line: node.line,
        source: ctx.source,
      },
    )
  }
}

function checkMutability(ctx, node, state) {
  if (node.kind !== ASTType.Identifier) return

  const binding = state.lookup(node.value)

  if (!binding.mutable) {
    throw new MutabilityError(
      `cannot mutate '${node.value}' as it was declared immutable`,
      {
        line: node.line,
        source: ctx.source,
      },
    )
  }
}

function getRootIdentifier(node) {
  if (node.kind === ASTType.Identifier) return node
  if (node.kind === ASTType.MemberExpression)
    return getRootIdentifier(node.object)
  return null
}

function analyseArguments(ctx, params, args, state, receiver = null) {
  if (params.length > 0 && params[0].name === "self") {
    let self = params.shift()
    // log("receiver: ", receiver, self)

    if (self.ownership.kind === OwnershipKind.Move) {
      state.update(receiver, BindingState.MOVED)
    }

    if (
      self.ownership.kind === OwnershipKind.BorrowMut &&
      !state.lookup(receiver).mutable
    ) {
      throw new Error(`Self and ${receiver} must be mutable.`)
    }

    // analyse self here
  }
  // log("params: ", params)
  // log("args: ", args)

  if (params.length !== args.length) {
    throw new Error(`Params and Args must have the same length.`)
  }

  for (let i = 0; i < params.length; i++) {
    const param = params[i]
    const arg = args[i]

    // log("param: ", param)
    // log("arg: ", arg)

    if (!arg) continue

    const argNode = arg.value
    const bindingName = argNode.value
    if (argNode.kind !== ASTType.Identifier) continue

    const source = state.lookup(bindingName)

    if (argNode.kind === ASTType.Identifier) {
      if (!source) {
        if (argNode.resolved) continue // it's a function/symbol, valid
        throw new ReferenceError(
          `binding '${bindingName}' is not available in this scope`,
          { line: argNode.line, source: ctx.source },
        )
      }

      if (source.state === BindingState.MOVED) {
        throw new UseAfterMoveError(
          `binding '${bindingName}' was already moved`,
          {
            line: argNode.line,
            source: ctx.source,
          },
        )
      }
    }

    const argKind = arg.ownership.kind

    if (param.ownership.kind === OwnershipKind.BorrowMut) {
      if (argKind === OwnershipKind.Borrow) {
        throw new OwnershipError(
          `cannot immutably borrow '${bindingName}', borrow mutably or move/clone`,
          {
            line: argNode.line,
            source: ctx.source,
          },
        )
      }
    }

    if (param.ownership.kind === OwnershipKind.Move) {
      if (![OwnershipKind.Move, OwnershipKind.Clone].includes(argKind)) {
        throw new OwnershipError(
          `move param '${bindingName}' allows only move/clone`,
          {
            line: argNode.line,
            source: ctx.source,
          },
        )
      }
    }

    if (param.ownership.kind === OwnershipKind.Clone) {
      if (argKind !== OwnershipKind.Clone) {
        throw new OwnershipError(
          `clone param '${bindingName}' allows only clone`,
          {
            line: argNode.line,
            source: ctx.source,
          },
        )
      }
    }

    if (argKind === OwnershipKind.Move) {
      state.update(bindingName, BindingState.MOVED)
    }
  }
}

function processStatements(ctx, statements, state) {
  for (const stmt of statements) {
    // log(stmt.kind)
    switch (stmt.kind) {
      case ASTType.VariableDeclaration: {
        if (state.has(stmt.name) && stmt.isParam) {
          throw new Error(
            `Cannot reinitialise [${stmt.name}] because it is a param. `,
          )
        }
        if (state.has(stmt.name) && stmt.name === "self") {
          throw new Error(
            `Cannot reinitialise [${stmt.name}] because it is of Self type. `,
          )
        }
        state.declare(stmt.name, {
          state: BindingState.ALIVE,
          mutable: stmt.mutable,
          type: stmt.type,
        })

        if (stmt.isParam) continue

        if (stmt?.init)
          if (stmt.init.kind === ASTType.Identifier) {
            checkIdentifier(ctx, stmt.init, state)
            state.update(stmt.init.value, BindingState.MOVED)
          } else if (stmt.init.kind === ASTType.MemberExpression) {
            const root = getRootIdentifier(stmt.init)
            if (root) {
              /**
               * IMPORTANT!
               * TO BE CHANGED TO PARIALLY MOVED AFTER CURRENT STAGE IS DONE.
               */
              checkIdentifier(ctx, root, state)
              state.update(root.value, BindingState.MOVED)
            }
          } else {
            processStatements(ctx, [stmt.init], state)
          }

        break
      }

      case ASTType.AssignmentExpression: {
        // log(stmt)
        if (stmt.left.kind === ASTType.Identifier) {
          checkIdentifier(ctx, stmt.left, state)
          checkMutability(ctx, stmt.left, state)
          checkIdentifier(ctx, stmt.right, state)
          if (stmt.right.kind === ASTType.Identifier) {
            state.update(stmt.right.value, BindingState.MOVED)
          }
        } else if (stmt.left.kind === ASTType.MemberExpression) {
          checkIdentifier(ctx, stmt.left.object, state)
          checkMutability(ctx, stmt.left.object, state)
          const root = getRootIdentifier(stmt.right)
          if (root) {
            /**
             * IMPORTANT!
             * TO BE CHANGED TO PARIALLY MOVED AFTER CURRENT STAGE IS DONE.
             */
            checkIdentifier(ctx, root, state)
            state.update(root.value, BindingState.MOVED)
          }
          const resolved = stmt.left.resolved
          if (resolved?.kind === "FIELD" && !resolved.field.mutable) {
            throw new MutabilityError(
              `cannot mutate '${stmt.left.property}' as it was declared immutable`,
              { line: stmt.line, source: ctx.source },
            )
          }
        }

        break
      }

      case ASTType.CallExpression: {
        const resolved = stmt.resolved
        if (!resolved) break

        const params = [...resolved.node.params]
        const receiver =
          stmt.callee.kind === ASTType.MemberExpression
            ? stmt.callee.object.value
            : null

        analyseArguments(ctx, params, stmt.args, state, receiver)
        break
      }

      case ASTType.ReturnStatement:
        if (stmt.argument?.kind === ASTType.Identifier) {
          checkIdentifier(ctx, stmt.argument, state)
          state.update(stmt.argument.value, BindingState.MOVED)
        }
        break

      case ASTType.UpdateExpression:
        checkIdentifier(ctx, stmt.operand, state)
        checkMutability(ctx, stmt.operand, state)
        break

      case ASTType.BinaryExpression:
        if (stmt.left.kind === ASTType.Identifier)
          checkIdentifier(ctx, stmt.left, state)
        if (stmt.right.kind === ASTType.Identifier)
          checkIdentifier(ctx, stmt.right, state)
        break

      // case ASTType.CloneExpression:
      //   if (stmt.value.kind === ASTType.Identifier)
      //     checkIdentifier(ctx, stmt.value, state)
      //   break

      case ASTType.MoveExpression:
        if (stmt.value.kind === ASTType.Identifier) {
          checkIdentifier(ctx, stmt.value, state)
          state.update(stmt.value.value, BindingState.MOVED)
        }
        break

      case ASTType.UnaryExpression:
        checkIdentifier(ctx, stmt.operand, state)
        break

      case ASTType.StructLiteral:
        const resolved = stmt.resolved
        if (resolved.kind !== SymbolKind.STRUCT) {
          throw new Error(
            `Resolved kind must be STRUCT, but got [${resolved.kind}]`,
          )
        }

        // MIGHT MOVE THIS TO TYPECHEKER
        let fields = stmt.fields

        if (resolved.node.fields.length !== fields.length) {
          throw new Error(
            `Lengths do not match. Requires ${resolved.node.fields.length} but got ${fields.length}`,
          )
        }

        // match names
        for (let i = 0; i < resolved.node.fields.length; i++) {
          let structField = resolved.node.fields[i]
          let field = fields[i]
          if (structField.name !== field.name) {
            throw new Error(
              `Order matters when declaring a struct literal. Expected [${structField.name}] but got [${field.name}].`,
            )
          }
        }
        // DOWN TO THIS

        for (const field of stmt.fields) {
          if (field.value.kind === ASTType.Identifier) {
            checkIdentifier(ctx, field.value, state)
            state.update(field.value.value, BindingState.MOVED)
          }
        }
        break

      case ASTType.ArrayExpression:
        for (const el of stmt.elements) {
          if (el.kind === ASTType.Identifier) {
            checkIdentifier(ctx, el, state)
            state.update(el.value, BindingState.MOVED)
          }
        }
        break
      case ASTType.MemberExpression:
        {
        }

        break
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
    state = processStatements(ctx, block.statements, state)
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
      // new Map(state),
      new Set(visited),
      joinId,
    )

    const stateB = visit(
      ctx,
      blocks,
      block.alternate,
      state.clone(),
      // new Map(state),
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

  for (const [name, state] of a.get()[0].entries()) {
    if (!b.has(name)) continue

    const stateB = b.get()[0].get(name)

    merged.update(name, {
      ...state,
      state:
        state.state === BindingState.MOVED ||
        stateB.state === BindingState.MOVED
          ? BindingState.MOVED
          : state.state,
    })
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

function analyze(context, source) {
  const ctx = { source, ...context }

  let table = ctx.table.get()

  for (let [key, entry] of table) {
    if (entry.kind === SymbolKind.STRUCT) continue
    if (!entry.cfg) continue

    const state = new ScopeStack()

    visit(
      { ...ctx, currentFunction: entry.node },
      entry.cfg.blocks,
      entry.cfg.entryId,
      state,
    )
  }
}

export { analyze }
