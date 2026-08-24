import { log } from "../helper.js"
import { ASTType, OwnershipKind, BlockKind, SymbolKind } from "./types.js"

function createContext() {
  let loopStack = []
  return {
    id: 0,
    blocks: {},
    currentId: null,
    get loopStack() {
      return loopStack
    },
    get currentLoop() {
      return loopStack[loopStack.length - 1]
    },
  }
}

function createBasicBlock(ctx) {
  let id = ++ctx.id
  ctx.blocks[id] = {
    id,
    kind: BlockKind.BasicBlock,
    statements: [],
    terminated: false,
  }
  return id
}

function createBranchBlock(ctx, condition) {
  let id = ++ctx.id
  ctx.blocks[id] = {
    id,
    kind: BlockKind.BranchBlock,
    condition,
    consequent: null,
    alternate: null,
  }
  return id
}

function addStatement(ctx, node) {
  ctx.blocks[ctx.currentId].statements.push(node)
}

function connect(ctx, from, to) {
  if (ctx.blocks[from].kind !== BlockKind.BranchBlock) {
    ctx.blocks[from].next = to
  }
  if (!ctx.blocks[to].predecessors) {
    ctx.blocks[to].predecessors = []
  }
  ctx.blocks[to].predecessors.push(from)
}

function addPredecessors(ctx, from, to) {
  if (!ctx.blocks[to].predecessors) {
    ctx.blocks[to].predecessors = []
  }

  ctx.blocks[to].predecessors.push(from)
}

function isTerminated(ctx, id) {
  return ctx.blocks[id].terminated
}

function lowerBody(ctx, body) {
  for (let stmt of body) {
    // log(stmt)
    if (stmt.kind === ASTType.IfStatement) {
      const previousId = ctx.currentId
      const ifBlockId = createBranchBlock(ctx, stmt.condition)

      connect(ctx, previousId, ifBlockId)

      const consequentId = createBasicBlock(ctx)
      ctx.blocks[ifBlockId].consequent = consequentId

      connect(ctx, ifBlockId, consequentId)

      ctx.currentId = consequentId
      lowerBody(ctx, stmt.consequent.body)
      let consequentIdEnd = ctx.currentId

      const jointId = createBasicBlock(ctx)

      let alternateIdEnd = null
      if (stmt.alternate) {
        const alternateId = createBasicBlock(ctx)
        ctx.blocks[ifBlockId].alternate = alternateId
        connect(ctx, ifBlockId, alternateId)

        ctx.currentId = alternateId
        lowerBody(ctx, stmt.alternate.body)
        alternateIdEnd = ctx.currentId
      } else {
        ctx.blocks[ifBlockId].alternate = jointId
        connect(ctx, ifBlockId, jointId)
      }

      if (!isTerminated(ctx, consequentIdEnd))
        connect(ctx, consequentIdEnd, jointId)
      if (alternateIdEnd) {
        if (!isTerminated(ctx, alternateIdEnd))
          connect(ctx, alternateIdEnd, jointId)
      }

      ctx.currentId = jointId
    } else if (stmt.kind === ASTType.WhileStatement) {
      const previousId = ctx.currentId
      const branchBlockId = createBranchBlock(ctx, stmt.condition)

      connect(ctx, previousId, branchBlockId)
      const jointId = createBasicBlock(ctx)

      ctx.loopStack.push({ headerId: branchBlockId, exitId: jointId })

      const consequentId = createBasicBlock(ctx)
      ctx.blocks[branchBlockId].consequent = consequentId
      addPredecessors(ctx, branchBlockId, consequentId)

      ctx.currentId = consequentId
      lowerBody(ctx, stmt.body.body) // while.body.body
      let consequentIdEnd = ctx.currentId
      if (!isTerminated(ctx, consequentIdEnd)) {
        connect(ctx, consequentIdEnd, branchBlockId)
      } // back edge
      ctx.loopStack.pop()

      ctx.blocks[branchBlockId].alternate = jointId
      addPredecessors(ctx, branchBlockId, jointId)

      ctx.currentId = jointId
    } else if (stmt.kind === ASTType.LoopStatement) {
      const previousId = ctx.currentId
      const loopId = createBasicBlock(ctx)
      connect(ctx, previousId, loopId)
      ctx.currentId = loopId

      const jointId = createBasicBlock(ctx)

      ctx.loopStack.push({ headerId: loopId, exitId: jointId })

      lowerBody(ctx, stmt.body.body)

      let loopBodyEnd = ctx.currentId
      if (!isTerminated(ctx, loopBodyEnd)) {
        connect(ctx, loopBodyEnd, loopId)
      }
      ctx.loopStack.pop()
      ctx.currentId = jointId
    } else if (stmt.kind === ASTType.ForStatement) {
      const previousId = ctx.currentId
      const branchBlockId = createBranchBlock(ctx, stmt.iterable)

      connect(ctx, previousId, branchBlockId)
      const jointId = createBasicBlock(ctx)

      ctx.loopStack.push({ headerId: branchBlockId, exitId: jointId })

      const consequentId = createBasicBlock(ctx)

      ctx.blocks[branchBlockId].consequent = consequentId
      addPredecessors(ctx, branchBlockId, consequentId)

      ctx.currentId = consequentId

      addStatement(ctx, {
        kind: ASTType.VariableDeclaration,
        name: stmt.binding,
        type: null,
        mutable: stmt.ownership.kind === OwnershipKind.BorrowMut,
        // init: null,
        iterable: stmt.iterable,
        ownership: stmt.ownership,
        isForBinding: true,
      })
      lowerBody(ctx, stmt.body.body)
      let consequentIdEnd = ctx.currentId
      if (!isTerminated(ctx, consequentIdEnd)) {
        connect(ctx, consequentIdEnd, branchBlockId)
      } // back edge
      ctx.loopStack.pop()

      ctx.blocks[branchBlockId].alternate = jointId
      addPredecessors(ctx, branchBlockId, jointId)

      ctx.currentId = jointId
    } else if (stmt.kind === ASTType.BreakStatement) {
      ctx.blocks[ctx.currentId].terminated = true
      connect(ctx, ctx.currentId, ctx.currentLoop.exitId)
    } else if (stmt.kind === ASTType.ContinueStatement) {
      ctx.blocks[ctx.currentId].terminated = true
      connect(ctx, ctx.currentId, ctx.currentLoop.headerId)
    } else if (stmt.kind === ASTType.ReturnStatement) {
      addStatement(ctx, stmt)
      ctx.blocks[ctx.currentId].terminated = true
    } else {
      if (!ctx.blocks[ctx.currentId].terminated) addStatement(ctx, stmt)
    }
  }
}

function lowerFunction(body, ctx = createContext()) {
  const entryId = createBasicBlock(ctx)
  ctx.currentId = entryId
  lowerBody(ctx, body)

  return { entryId, blocks: ctx.blocks }
}

function lowerMain(ast, context) {
  const { table: symbols } = context
  const mainStatements = ast.body.filter(
    (node) =>
      node.kind !== ASTType.FunctionDeclaration &&
      node.kind !== ASTType.StructDeclaration &&
      node.kind !== ASTType.ImplBlock &&
      node.kind !== ASTType.TypeDeclaration &&
      node.kind !== ASTType.UseStatement,
  )

  symbols.register(["__main__"], {
    kind: SymbolKind.FUNCTION,
    node: {
      name: "__main__",
      body: mainStatements,
    },
    cfg: lowerFunction(mainStatements),
  })
}

export { lowerMain, lowerFunction }
