import { TokenType, ASTType, PrimitiveTypes, OwnershipKind } from "./types.js"
import { ExportError } from "./errors.js"
import { log } from "../helper.js"
function parser(tokens, source) {
  let pos = 0
  const peek = (offset = 0) => tokens[pos + offset]
  const eat = (expectedType) => {
    const token = peek()
    if (token.type !== expectedType)
      throw new Error(
        `Expected ${expectedType} but got ${token.type} at line ${token.line}`,
      )
    pos++
    return token
  }

  const isPrimitive = (name) => PrimitiveTypes.has(name)

  function isTypeArray() {
    if (
      peek().type === TokenType.LBRACKET &&
      peek(1).type === TokenType.RBRACKET
    ) {
      eat(TokenType.LBRACKET)
      eat(TokenType.RBRACKET)
      return true
    }
    return false
  }

  // <A: B + C, D>
  function parseBounds(bounds = []) {
    bounds.push(eat(TokenType.IDENT).value)
    if (peek().type === TokenType.PLUS) {
      eat(TokenType.PLUS)
      parseBounds(bounds)
    }
    return bounds
  }

  // fn foo <...> < parsetype ?: parsebounds ?,>
  function parseTypeParams(params = []) {
    eat(TokenType.LT)

    let result = parseTypeParam()

    params.push(result)

    while (peek().type !== TokenType.GT) {
      if (peek().type === TokenType.COMMA) {
        eat(TokenType.COMMA)
        params = [...params, parseTypeParam()]
      }
    }

    eat(TokenType.GT)

    return params
  }

  // T : Add Eq, later also imported ones || T: std::foo:Bar
  function parseTypeParam() {
    let result = {
      kind: ASTType.TypeParameter,
      name: eat(TokenType.IDENT).value,
      bounds: [],
    }
    if (peek().type === TokenType.COLON) {
      eat(TokenType.COLON)
      result.bounds = parseBounds()
    }

    return result
  }

  // let foo : <...> < parsetype ?<...> ?, >
  function parseTypeArgs(args = []) {
    eat(TokenType.LT)
    args.push(parseType())

    while (peek().type !== TokenType.GT) {
      if (peek().type === TokenType.COMMA) {
        eat(TokenType.COMMA)
        args.push(parseType())
      }
    }

    eat(TokenType.GT)

    return args
  }

  // Result<Vec<int>> ident ?<
  function parseType() {
    if (peek().type === TokenType.LBRACKET) {
      eat(TokenType.LBRACKET)
      eat(TokenType.RBRACKET)

      return {
        kind: ASTType.TypeArray,
        element: parseType(),
      }
    }

    const result = {
      kind: ASTType.TypeReference,
      name: eat(TokenType.IDENT).value,
    }

    if (peek().type === TokenType.LT) {
      result.type = parseTypeArgs()
    }

    return result
  }

  function parseLetDecl() {
    let async = false
    let token = eat(TokenType.LET)
    let isMut = false
    if (peek().type === TokenType.MUT) {
      eat(TokenType.MUT)
      isMut = true
    }
    const name = eat(TokenType.IDENT).value
    let type = null
    if (peek().type === TokenType.COLON) {
      eat(TokenType.COLON)
      type = parseType()
    }

    if (peek().type === TokenType.LEFT_ARROW) {
      eat(TokenType.LEFT_ARROW)
      async = true
    } else {
      eat(TokenType.EQ)
    }

    let init = parseExpression()

    return {
      kind: ASTType.VariableDeclaration,
      name,
      async,
      type,
      mutable: isMut,
      init,
      line: token.line,
    }
  }

  function parseReturnType() {
    if (peek().type === TokenType.RIGHT_ARROW) {
      eat(TokenType.RIGHT_ARROW)
      return {
        kind: ASTType.ReturnType,
        type: parseType(),
      }
    }

    return null
  }

  function parseFunctionDecl() {
    let async = false
    if (peek().type === TokenType.ASYNC) {
      eat(TokenType.ASYNC)
      async = true
    }

    let token = eat(TokenType.FUNCTION)
    const name = eat(TokenType.IDENT).value
    let typeParameters = []
    if (peek().type == TokenType.LT) {
      typeParameters = parseTypeParams()
    }

    let params = parseParamList()
    let returnType = parseReturnType()

    let body = parseBlockStmt()

    return {
      kind: ASTType.FunctionDeclaration,
      async,
      name,
      typeParameters,
      params,
      returnType,
      body,
      line: token.line,
    }
  }

  function parseReturnStmt() {
    let token = eat(TokenType.RETURN)
    let argument = parseExpression()

    return {
      kind: ASTType.ReturnStatement,
      argument,
      line: token.line,
    }
  }

  function parseParamList() {
    eat(TokenType.LPAREN)
    let params = []

    while (peek().type !== TokenType.RPAREN) {
      let ownership = parseOwnership()
      const name = eat(TokenType.IDENT).value
      let type = null
      if (peek().type === TokenType.COLON) {
        eat(TokenType.COLON)
        type = parseType()
        // log(type)
      }

      params.push({
        kind: ASTType.Param,
        name,
        ownership,
        type,
      })

      if (peek().type === TokenType.COMMA) {
        eat(TokenType.COMMA)
      }
    }
    eat(TokenType.RPAREN)

    return params
  }

  function parseArgList() {
    let start = eat(TokenType.LPAREN)
    let args = []

    while (peek().type !== TokenType.RPAREN) {
      let ownership = parseOwnership()
      if (peek().type === TokenType.PIPE || peek().type === TokenType.OR_OR) {
        args.push({
          kind: ASTType.Argument,
          value: "anonymus",
          closure: parseClosure(),
          ownership,
        })
      } else {
        const value = parseExpression()
        args.push({
          kind: ASTType.Argument,
          value,
          ownership,
          line: value.line ?? start.line,
        })
      }
      consume(TokenType.COMMA)
    }
    eat(TokenType.RPAREN)

    return args
  }

  function parseCallExpression(callee) {
    let typeArgs = []
    if (peek().type === TokenType.LT) {
      typeArgs = parseTypeArgs()
    }
    const args = parseArgList()

    return {
      kind: ASTType.CallExpression,
      callee,
      typeArgs,
      args,
      line: callee?.line,
    }
  }

  function parseMoveVariable() {
    let token = eat(TokenType.MOVE)
    let value = eat(TokenType.IDENT).value

    return { kind: ASTType.Identifier, value, moved: true, line: token.line }
  }
  // function parseCloneVariable() {
  //   let token = eat(TokenType.CLONE)
  //   let value = eat(TokenType.IDENT).value

  //   return { kind: ASTType.Identifier, value, cloned: true, line: token.line }
  // }

  function parseUnaryExpression() {
    let op = peek()
    if (op.type === TokenType.MINUS) eat(TokenType.MINUS)
    if (op.type === TokenType.BANG) eat(TokenType.BANG)
    let operand = parsePrimary()
    return {
      kind: ASTType.UnaryExpression,
      op: op.value,
      operand,
      prefix: false,
      line: op.line,
    }
  }

  /**
 *  let x = match foo()  {
  Ok(val) => val
  Err(e) => 0
}
 */
  function parsePattern() {
    const path = [eat(TokenType.IDENT).value]

    while (peek().type === TokenType.COLON_COLON) {
      eat(TokenType.COLON_COLON)
      path.push(eat(TokenType.IDENT).value)
    }

    const name = path.join("::")
    const bindings = []

    if (peek().type === TokenType.LPAREN) {
      eat(TokenType.LPAREN)

      if (peek().type !== TokenType.RPAREN) {
        bindings.push(eat(TokenType.IDENT).value)

        while (peek().type === TokenType.COMMA) {
          eat(TokenType.COMMA)
          bindings.push(eat(TokenType.IDENT).value)
        }
      }

      eat(TokenType.RPAREN)
    }

    return {
      kind: name === "_" ? ASTType.WildcardPattern : ASTType.VariantPattern,
      name,
      bindings,
    }
  }

  function parseArms() {
    let arms = []
    eat(TokenType.LBRACE)
    while (peek().type !== TokenType.RBRACE) {
      let pattern = parsePattern()
      eat(TokenType.FAT_ARROW)
      // later we will support also implicit return, currently only body
      let body = parseBlockStmt()
      // let body = parseExpression()

      arms.push({ pattern, body })
    }
    eat(TokenType.RBRACE)
    return arms
  }

  function parseMatchExpression() {
    eat(TokenType.MATCH)
    let subject = parsePrimary(true)
    let arms = parseArms()

    return {
      kind: ASTType.MatchExpression,
      subject,
      arms,
    }
  }

  function parseUnsafe({ async }) {
    let token = eat(TokenType.UNSAFE)

    return {
      kind: ASTType.UnsafeExpression,
      async,
      body: token.value,
    }
  }

  function consume(type) {
    if (peek().type === type) eat(type)
  }

  function parseClosure() {
    let body = null
    let params = []
    let type = null
    let capture = []
    let ownership = parseOwnership()

    if (peek().type === TokenType.LBRACKET) {
      eat(TokenType.LBRACKET)
      let t = peek().type
      if (t === TokenType.AMP || t === TokenType.IDENT) {
        let ownership = parseOwnership()
        let name = eat(TokenType.IDENT).value
        capture.push({ ownership, name })
        consume(TokenType.COMMA)
      }
      eat(TokenType.RBRACKET)
    }

    if (peek().type === TokenType.OR_OR) {
      eat(TokenType.OR_OR)
    } else if (peek().type === TokenType.PIPE) {
      eat(TokenType.PIPE)
      while (peek().type !== TokenType.PIPE) {
        let ownership = parseOwnership()
        let name = eat(TokenType.IDENT).value
        if (peek().type === TokenType.COLON) {
          eat(TokenType.COLON)
          type = parseType()
        }
        params.push({ kind: ASTType.Param, name, ownership, type })
        consume(TokenType.COMMA)
      }
      eat(TokenType.PIPE)
    }

    body = parseBlockStmt()

    return {
      kind: ASTType.ClosureExpression,
      params,
      body,
      ownership,
      capture,
    }
  }

  function parseStructLiteralFields() {
    eat(TokenType.LBRACE)

    let fields = []
    while (peek().type !== TokenType.RBRACE) {
      let token = eat(TokenType.IDENT)
      let name = token.value
      let value = name
      if (peek().type === TokenType.COLON) {
        eat(TokenType.COLON)
        value = parsePrimary() // must be checked later
      }

      fields.push({ name, value, line: token.line })

      if (peek().type === TokenType.COMMA) eat(TokenType.COMMA)
    }

    eat(TokenType.RBRACE)
    return fields
  }

  function parsePrimary(noStructLiteral = false) {
    if (peek().type === TokenType.LPAREN) {
      eat(TokenType.LPAREN)
      let expr = parseExpression()
      eat(TokenType.RPAREN)
      return expr
    }

    if (
      peek().type === TokenType.OR_OR ||
      peek().type === TokenType.PIPE ||
      peek().type === TokenType.AMP
    ) {
      return parseClosure(false)
    }
    if (peek().type === TokenType.MATCH) {
      return parseMatchExpression()
    } else if (
      peek().type === TokenType.PLUS_PLUS ||
      peek().type === TokenType.MINUS_MINUS
    ) {
      const op = peek()
      eat(op.type)
      const operand = parsePrimary()
      return {
        kind: ASTType.UpdateExpression,
        op: op.value,
        operand,
        prefix: true,
        line: op.line,
      }
    }
    if (peek().type === TokenType.BANG || peek().type === TokenType.MINUS) {
      return parseUnaryExpression()
    }

    if (peek().type === TokenType.IDENT && peek(1).type === TokenType.LBRACE) {
      let token = eat(TokenType.IDENT)
      let name = token.value
      if (!noStructLiteral) {
        let fields = parseStructLiteralFields()

        return {
          kind: ASTType.StructLiteral,
          name,
          path: [name],
          fields,
          line: token.line,
        }
      } else {
        return {
          kind: ASTType.Identifier,
          value: name,
          line: token.line,
        }
      }
    }
    if (peek().type === TokenType.NUMBER) {
      const token = eat(TokenType.NUMBER)
      return { kind: ASTType.NumberLiteral, value: token.value }
    } else if (peek().type === TokenType.STRING) {
      const token = eat(TokenType.STRING)
      return { kind: ASTType.StringLiteral, value: token.value }
    } else if (peek().type === TokenType.IDENT) {
      const token = eat(TokenType.IDENT)

      // if (isVariant(token.value)) {
      //   return { kind: ASTType.VariantExpression, name: token.value, args: [] }
      // }

      if (
        peek().type === TokenType.PLUS_PLUS ||
        peek().type === TokenType.MINUS_MINUS
      ) {
        const op = peek()
        eat(op.type)
        return {
          kind: ASTType.UpdateExpression,
          op: op.value,
          operand: {
            kind: ASTType.Identifier,
            value: token.value,
            line: token.line,
          },
        }
      }

      let left = {
        kind: ASTType.Identifier,
        value: token.value,
        line: token.line,
      }

      while (
        peek().type === TokenType.DOT ||
        peek().type === TokenType.COLON_COLON
      ) {
        if (peek().type === TokenType.DOT) {
          eat(TokenType.DOT)
          let property = eat(TokenType.IDENT).value

          left = {
            kind: ASTType.MemberExpression,
            object: left,
            property,
            line: token.line,
          }
        } else {
          eat(TokenType.COLON_COLON)

          if (peek().type === TokenType.LT) {
            return parseCallExpression(left)
          }

          let segment = eat(TokenType.IDENT).value

          if (left.kind === ASTType.PathExpression) {
            left.path.push(segment)
          } else {
            left = {
              kind: ASTType.PathExpression,
              path: [left.value, segment],
              line: token.line,
            }
          }
        }
      }

      if (peek().type === TokenType.LBRACE) {
        let fields = parseStructLiteralFields()
        // struct literal must have a path

        return {
          kind: ASTType.StructLiteral,
          path: left.path ?? [],
          fields,
          line: token.line,
        }
      }

      if (peek().type === TokenType.LPAREN) {
        return parseCallExpression(left)
      }

      return left
    } else if (
      peek().type === TokenType.TRUE ||
      peek().type === TokenType.FALSE
    ) {
      const token = eat(peek().type)
      return {
        kind: ASTType.BooleanLiteral,
        value: token.value ? "true" : "false",
      }
    } else if (peek().type === TokenType.LBRACKET) {
      if (isCaptureList()) {
        return parseClosure()
      }

      let elements = []
      eat(TokenType.LBRACKET)
      while (peek().type !== TokenType.RBRACKET) {
        elements.push(parsePrimary())
        if (peek().type === TokenType.COMMA) eat(TokenType.COMMA)
      }
      eat(TokenType.RBRACKET)

      return {
        kind: ASTType.ArrayExpression,
        elements,
      }
    }
  }

  function isCaptureList() {
    let depth = 0
    let i = pos // currently sitting on LBRACKET
    while (i < tokens.length) {
      if (tokens[i].type === TokenType.LBRACKET) depth++
      if (tokens[i].type === TokenType.RBRACKET) {
        depth--
        if (depth === 0) {
          let after = tokens[i + 1]?.type
          return after === TokenType.PIPE || after === TokenType.OR_OR
        }
      }
      i++
    }
    return false
  }

  function parseAssignmentExpression(left, op) {
    let right = parseExpression()
    return {
      kind: ASTType.AssignmentExpression,
      left,
      op,
      right,
      line: left?.line ?? op?.line,
    }
  }

  function parseExpression() {
    let async = false
    if (peek().type === TokenType.ASYNC) {
      eat(TokenType.ASYNC)
      async = true
    }

    if (peek().type === TokenType.MOVE) {
      eat(TokenType.MOVE)

      return {
        kind: ASTType.MoveExpression,
        value: parsePrimary(),
      }
    }
    // if (peek().type === TokenType.CLONE) {
    //   eat(TokenType.CLONE)

    //   return {
    //     kind: ASTType.CloneExpression,
    //     value: parsePrimary(),
    //   }
    // }
    if (peek().type === TokenType.ASYNC) {
      return parseExpression()
    }

    if (peek().type === TokenType.UNSAFE) {
      return parseUnsafe({ async })
    }

    let left = parsePrimary()
    if (left) {
      // if (peek().type === TokenType.EQ && left.kind === ASTType.Identifier) {
      if (peek().type === TokenType.EQ) {
        let op = eat(TokenType.EQ).value
        return parseAssignmentExpression(left, op)
      } else {
        return parseBinaryExpression(left, 0)
      }
    }
  }

  function parseBlockStmt() {
    eat(TokenType.LBRACE)
    let body = []
    while (peek().type !== TokenType.RBRACE) {
      body.push(parseStatement())
    }
    eat(TokenType.RBRACE)

    return {
      kind: ASTType.BlockStatement,
      body,
    }
  }

  function parseIfStmt() {
    let token = eat(TokenType.IF)
    let condition = parseExpression()
    let consequent = parseBlockStmt()
    let alternate = null

    if (peek().type === TokenType.ELSE) {
      eat(TokenType.ELSE)
      if (peek().type === TokenType.IF) {
        alternate = parseIfStmt()
      } else {
        alternate = parseBlockStmt()
      }
    }

    return {
      kind: ASTType.IfStatement,
      condition,
      consequent,
      alternate,
      line: token.line,
    }
  }

  function parseStructFields(isMutable) {
    eat(TokenType.LBRACE)
    let fields = []
    while (peek().type !== TokenType.RBRACE) {
      let mutable = false
      if (!isMutable && peek().type === TokenType.MUT) {
        eat(TokenType.MUT)
        mutable = true
      }
      let name = eat(TokenType.IDENT).value
      let type = null
      if (peek().type === TokenType.COLON) {
        eat(TokenType.COLON)
        type = parseType()
      }

      fields.push({ name, mutable: isMutable || mutable, type })
      if (peek().type === TokenType.COMMA) eat(TokenType.COMMA)
    }
    eat(TokenType.RBRACE)

    return fields
  }

  function parseStructDecl() {
    let token = eat(TokenType.STRUCT)
    let mutable = false
    if (peek().type === TokenType.MUT) {
      eat(TokenType.MUT)
      mutable = true
    }
    let path = [eat(TokenType.IDENT).value]
    let typeParameters = ([] = [] = [])
    if (peek().type == TokenType.LT) {
      typeParameters = parseTypeParams()
    }

    let fields = parseStructFields(mutable)

    return {
      kind: ASTType.StructDeclaration,
      mutable,
      path,
      typeParameters,
      fields,
      line: token.line,
    }
  }

  function parseMethodsDecl() {
    let methods = []

    while (peek().type !== TokenType.RBRACE) {
      let async = false
      let self = null
      if (peek().type === TokenType.ASYNC) {
        eat(TokenType.ASYNC)
        async = true
      }

      eat(TokenType.FUNCTION)
      let name = eat(TokenType.IDENT).value

      let params = []
      eat(TokenType.LPAREN)
      while (peek().type !== TokenType.RPAREN) {
        let ownership = parseOwnership()

        let name = eat(TokenType.IDENT).value
        let type = null
        if (peek().type === TokenType.COLON) {
          eat(TokenType.COLON)
          type = parseType()
        }
        if (name === "self") {
          self = { ownership }
        } else {
          params.push({ name, ownership, type })
        }
        if (peek().type === TokenType.COMMA) eat(TokenType.COMMA)
      }
      eat(TokenType.RPAREN)

      let returnType = parseReturnType()

      let body = parseBlockStmt()
      methods.push({
        kind: ASTType.MethodDeclaration,
        name,
        async,
        self,
        static: self === null ? true : false,
        params,
        body,
        returnType,
      })
    }

    return methods
  }

  function parseImplDecl() {
    let token = eat(TokenType.IMPL)
    let name = eat(TokenType.IDENT).value
    eat(TokenType.LBRACE)
    let methods = parseMethodsDecl()
    eat(TokenType.RBRACE)

    return {
      kind: ASTType.ImplBlock,
      name,
      methods,
      line: token.line,
    }
  }
  function parseTypeVariants(variants) {
    let name = eat(TokenType.IDENT).value
    let params = []
    if (peek().type === TokenType.LPAREN) {
      eat(TokenType.LPAREN)
      while (peek().type !== TokenType.RPAREN) {
        params.push(eat(TokenType.IDENT).value)
        if (peek().type === TokenType.COMMA) eat(TokenType.COMMA)
      }
      eat(TokenType.RPAREN)
    }
    variants.push({ name, params })

    if (peek().type === TokenType.PIPE) {
      eat(TokenType.PIPE)
      variants = parseTypeVariants(variants)
    }

    return variants
  }

  function parseTypeStmt() {
    eat(TokenType.TYPE)
    let name = eat(TokenType.IDENT).value

    let typeParameters = []
    if (peek().type == TokenType.LT) {
      typeParameters = parseTypeParams()
    }
    eat(TokenType.EQ)
    let variants = parseTypeVariants([])

    return {
      kind: ASTType.TypeDeclaration,
      name,
      typeParameters,
      variants,
    }
  }

  function parseWhileStmt() {
    let token = eat(TokenType.WHILE)
    let condition = parseExpression()

    let body = parseBlockStmt()

    return {
      kind: ASTType.WhileStatement,
      condition,
      body,
      line: token.line,
    }
  }

  function parseOwnership() {
    if (peek().type === TokenType.AMP && peek(1).type === TokenType.MUT) {
      eat(TokenType.AMP)
      eat(TokenType.MUT)

      return {
        kind: OwnershipKind.BorrowMut,
      }
    }

    if (peek().type === TokenType.AMP) {
      eat(TokenType.AMP)

      return {
        kind: OwnershipKind.Borrow,
      }
    }

    // if (peek().type === TokenType.CLONE) {
    //   eat(TokenType.CLONE)

    //   return {
    //     kind: OwnershipKind.Clone,
    //   }
    // }

    if (peek().type === TokenType.MOVE) {
      eat(TokenType.MOVE)

      return {
        kind: OwnershipKind.Move,
      }
    }

    return {
      kind: OwnershipKind.Move,
    }
  }

  function parseForStmt() {
    let token = eat(TokenType.FOR)
    let binding = eat(TokenType.IDENT).value
    eat(TokenType.IN)

    let ownership = parseOwnership()
    let iterable = parsePrimary(true)
    let body = parseBlockStmt()

    return {
      kind: ASTType.ForStatement,
      binding,
      iterable,
      body,
      ownership,
      line: token.line,
    }
  }
  function parseLoopStmt() {
    let token = eat(TokenType.LOOP)
    let body = parseBlockStmt()
    return {
      kind: ASTType.LoopStatement,
      body,
      line: token.line,
    }
  }

  function parseBreakStmt() {
    let token = eat(TokenType.BREAK)
    return {
      kind: ASTType.BreakStatement,
      line: token.line,
    }
  }
  function parsecContinueStmt() {
    let token = eat(TokenType.CONTINUE)
    return {
      kind: ASTType.ContinueStatement,
      line: token.line,
    }
  }

  /**
   * {
      type: "UseStatement",
      path: ["std", "http"],
      imported: "Request"
      }
   */

  function resolveSymbols(symbols = []) {
    if (peek().type === TokenType.LBRACE) {
      eat(TokenType.LBRACE)
      while (peek().type !== TokenType.RBRACE) {
        symbols.push(eat(TokenType.IDENT).value)
        consume(TokenType.COMMA)
      }
      eat(TokenType.RBRACE)
    }
    return symbols
  }

  function resolvePath(path = []) {
    let name = eat(TokenType.IDENT).value
    path = [...path, name]
    if (peek().type === TokenType.COLON_COLON) {
      eat(TokenType.COLON_COLON)
      if (peek(1)?.type && peek(1).type === TokenType.COLON_COLON) {
        resolvePath(path)
      }
      if (peek().type === TokenType.IDENT)
        path = [...path, eat(TokenType.IDENT).value]
    }

    let symbols = resolveSymbols()

    return { path, symbols }
  }

  function parseUseDeclaration() {
    let token = eat(TokenType.USE)
    const { path, symbols } = resolvePath()

    return {
      kind: ASTType.UseStatement,
      path: path ?? [],
      symbols: symbols ?? [],
      line: token.line,
    }
  }

  function parsePubStmt() {
    eat(TokenType.PUB)

    let token = peek()

    const parse = statementParsers[token.type] // will restrict later

    const node = parse()
    node.pub = true

    return node
  }

  function parseSpawnStmt() {
    eat(TokenType.SPAWN)

    let argument = parseExpression()

    return {
      kind: ASTType.SpawnStatement,
      argument,
    }
  }

  const statementParsers = {
    [TokenType.LET]: parseLetDecl,
    [TokenType.FUNCTION]: parseFunctionDecl,
    [TokenType.ASYNC]: parseFunctionDecl,
    [TokenType.SPAWN]: parseSpawnStmt,
    [TokenType.RETURN]: parseReturnStmt,
    [TokenType.IF]: parseIfStmt,
    [TokenType.STRUCT]: parseStructDecl,
    [TokenType.IMPL]: parseImplDecl,
    [TokenType.TYPE]: parseTypeStmt,
    [TokenType.FOR]: parseForStmt,
    [TokenType.WHILE]: parseWhileStmt,
    [TokenType.LOOP]: parseLoopStmt,
    [TokenType.BREAK]: parseBreakStmt,
    [TokenType.CONTINUE]: parsecContinueStmt,
    [TokenType.USE]: parseUseDeclaration,
    [TokenType.PUB]: parsePubStmt,
  }

  function parseStatement() {
    const token = peek()
    const parser = statementParsers[token.type]
    if (parser) {
      return parser()
    } else {
      return parseExpression()
    }

    throw new Error(`Parse statement line: ${token.line} - pos: ${pos}`)
  }

  const precedence = {
    [TokenType.OR_OR]: 1,
    [TokenType.AND_AND]: 2,
    [TokenType.EQ_EQ]: 3,
    [TokenType.BANG_EQ]: 3,
    [TokenType.GT]: 4,
    [TokenType.LT]: 4,
    [TokenType.GT_EQ]: 4,
    [TokenType.LT_EQ]: 4,
    [TokenType.PLUS]: 5,
    [TokenType.MINUS]: 5,
    [TokenType.STAR]: 6,
    [TokenType.SLASH]: 6,
    [TokenType.PERCENT]: 6,
  }

  const getPrec = (token) => precedence[token.type] ?? 0

  function parseBinaryExpression(left, prevPrec) {
    while (true) {
      const op = peek()
      const nextPrec = getPrec(op)
      if (nextPrec === 0) break // it is not an operator
      if (nextPrec <= prevPrec) break // no need to recurse, this is the code condition

      eat(op.type) // meaning is operator, and it higher precendence

      let right = parsePrimary() // get that ast

      right = parseBinaryExpression(right, nextPrec) // no do the same on that ast

      left = {
        kind: ASTType.BinaryExpression,
        left,
        op: op.value,
        right,
        line: op.line,
      } // here we create the ast and left feeds into itself by creating a new structure
    }
    return left // return
  }

  const typeBlockTerminators = new Set([
    TokenType.LET,
    TokenType.FUNCTION,
    TokenType.STRUCT,
    TokenType.IMPL,
    TokenType.FOR,
    TokenType.WHILE,
    TokenType.LOOP,
    TokenType.MATCH,
    TokenType.RETURN,
    TokenType.TYPE,
    TokenType.EOF,
  ])

  // this will be replaced with a proper full pass

  function collectVariantNames(tokens) {
    const variants = new Set()
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type === TokenType.TYPE) {
        i += 3 // skip: type Name =
        while (i < tokens.length && !typeBlockTerminators.has(tokens[i].type)) {
          if (
            tokens[i].type === TokenType.IDENT &&
            (tokens[i - 1].type === TokenType.EQ ||
              tokens[i - 1].type === TokenType.PIPE)
          ) {
            variants.add(tokens[i].value)
          }
          i++
        }
        i--
      }
    }
    return variants
  }

  let Variants = collectVariantNames(tokens)
  let isVariant = (name) => Variants.has(name)

  function parseProgram() {
    const body = []
    while (peek().type !== TokenType.EOF) {
      let stmt = parseStatement()
      body.push(stmt)
      if (peek().type === TokenType.SEMI) eat(TokenType.SEMI)
    }
    return { kind: "Program", body }
  }

  return parseProgram()
}

export { parser }
