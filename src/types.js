const TokenType = {
  MUT: "MUT",
  MOVE: "MOVE",
  BORROW: "BORROW",
  SHARE: "SHARE",
  // CLONE: "CLONE",

  DOT: "DOT",

  AMP: "AMP",

  TRUE: "TRUE",
  FALSE: "FALSE",

  CONST: "CONST",
  LET: "LET",
  FUNCTION: "FUNCTION",
  ASYNC: "ASYNC",
  SPAWN: "SPAWN",

  RETURN: "RETURN",
  BREAK: "BREAK",
  CONTINUE: "CONTINUE",

  IDENT: "IDENT",
  NUMBER: "NUMBER",
  STRING: "STRING",

  LPAREN: "LPAREN",
  RPAREN: "RPAREN",
  LBRACE: "LBRACE",
  RBRACE: "RBRACE",
  COMMA: "COMMA",
  EQ: "EQ",
  COLON: "COLON",
  SEMI: "SEMI",

  PIPE: "PIPE",

  LBRACKET: "LBRACKET",
  RBRACKET: "RBRACKET",

  PLUS: "PLUS",
  MINUS: "MINUS",
  STAR: "STAR",
  SLASH: "SLASH",
  PERCENT: "PERCENT",
  GT: "GT",
  LT: "LT",
  BANG: "BANG",

  EQ_EQ: "EQ_EQ",
  BANG_EQ: "BANG_EQ",
  GT_EQ: "GT_EQ",
  LT_EQ: "LT_EQ",
  AND_AND: "AND_AND",
  OR_OR: "OR_OR",
  SLASH_SLASH: "SLASH_SLASH",

  FAT_ARROW: "FAT_ARROW",
  LEFT_ARROW: "LEFT_ARROW",
  RIGHT_ARROW: "RIGHT_ARROW",

  COLON_COLON: "COLON_COLON",

  PLUS_PLUS: "PLUS_PLUS",
  MINUS_MINUS: "MINUS_MINUS",

  IF: "IF",
  ELSE: "ELSE",

  CARET: "CARET",
  TILDE: "TILDE",

  QUESTION: "QUESTION",
  AT: "AT",
  HASH: "HASH",

  DOT_DOT: "DOT_DOT",

  UNDERSCORE: "UNDERSCORE",

  STRUCT: "STRUCT",
  IMPL: "IMPL",
  TYPE: "TYPE",
  MATCH: "MATCH",

  WHILE: "WHILE",
  LOOP: "LOOP",
  FOR: "FOR",
  IN: "IN",

  UNSAFE: "UNSAFE",

  PUB: "PUB",
  USE: "USE",
  MOD: "MOD",

  EOF: "EOF",
}

const BindingState = {
  ALIVE: "ALIVE",
  MOVED: "MOVED",
  BORROWED: "BORROWED",
  BORROWED_MUT: "BORROWED_MUT",
}

const ASTType = {
  Program: "Program",
  BreakStatement: "BreakStatement",
  ContinueStatement: "ContinueStatement",
  SpawnStatement: "SpawnStatement",
  UnsafeExpression: "UnsafeExpression",
  TypeDeclaration: "TypeDeclaration",
  ReturnType: "ReturnType",
  ClosureType: "ClosureType",
  VariantExpression: "VariantExpression",
  VariantPattern: "VariantPattern",
  VariableDeclaration: "VariableDeclaration",
  NumberLiteral: "NumberLiteral",
  StringLiteral: "StringLiteral",
  BooleanLiteral: "BooleanLiteral",
  Identifier: "Identifier",
  ArrayExpression: "ArrayExpression",
  FunctionDeclaration: "FunctionDeclaration",
  Param: "Param",
  Argument: "Argument",
  ReturnStatement: "ReturnStatement",
  CallExpression: "CallExpression",
  MoveExpression: "MoveExpression",
  // CloneExpression: "CloneExpression",
  BinaryExpression: "BinaryExpression",
  UnaryExpression: "UnaryExpression",
  UpdateExpression: "UpdateExpression",
  IfStatement: "IfStatement",
  BlockStatement: "BlockStatement",
  AssignmentExpression: "AssignmentExpression",
  StructDeclaration: "StructDeclaration",
  StructLiteral: "StructLiteral",
  MemberExpression: "MemberExpression",
  ImplBlock: "ImplBlock",
  MethodDeclaration: "MethodDeclaration",
  MatchExpression: "MatchExpression",
  WildcardPattern: "WildcardPattern",
  ForStatement: "ForStatement",
  WhileStatement: "WhileStatement",
  LoopStatement: "LoopStatement",
  ClosureExpression: "ClosureExpression",
  UseStatement: "UseStatement",
  PathExpression: "PathExpression",
  ModDeclaration: "ModDeclaration",
  ExportDeclaration: "ExportDeclaration",
  TypeParameter: "TypeParameter",
  TypeReference: "TypeReference",
  TypeArray: "TypeArray",
}

// const TypeKind = {
//   Named: "Named",
//   Array: "Array",
//   Generic: "Generic",
// }

const PrimitiveTypes = new Set(["number", "string", "bool", "void"]) // string will be removed

const TypeRegistryKind = {
  PRIMITIVE: "PRIMITIVE",
  STRUCT: "STRUCT",
  ALIAS: "ALIAS",
}

const OwnershipKind = {
  Move: "Move",
  Borrow: "Borrow",
  BorrowMut: "BorrowMut",
  Clone: "Clone",
}

const BlockKind = {
  BasicBlock: "BasicBlock",
  BranchBlock: "BranchBlock",
}

const SymbolKind = {
  FUNCTION: "FUNCTION",
  METHOD: "METHOD",
  STRUCT: "STRUCT",
  FIELD: "FIELD",
  BINDING: "BINDING",
  TYPE_PARAM_METHOD: "TYPE_PARAM_METHOD",
  VARIANT: "VARIANT",
}

export {
  TokenType,
  ASTType,
  PrimitiveTypes,
  OwnershipKind,
  BlockKind,
  BindingState,
  SymbolKind,
  TypeRegistryKind,
}
