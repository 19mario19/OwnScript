import util from "util"
import { ASTType, TokenType } from "./types.js"
import { log } from "../helper.js"

const KEYWORDS = {
  mut: TokenType.MUT,
  move: TokenType.MOVE,
  // clone: TokenType.CLONE,
  borrow: TokenType.BORROW,
  share: TokenType.SHARE,
  const: TokenType.CONST,
  let: TokenType.LET,

  true: TokenType.TRUE,
  false: TokenType.FALSE,
  // function: TokenType.FUNCTION,
  fn: TokenType.FUNCTION,
  async: TokenType.ASYNC,
  return: TokenType.RETURN,
  break: TokenType.BREAK,
  continue: TokenType.CONTINUE,
  if: TokenType.IF,
  else: TokenType.ELSE,

  struct: TokenType.STRUCT,
  impl: TokenType.IMPL,
  type: TokenType.TYPE,
  match: TokenType.MATCH,

  loop: TokenType.LOOP,
  while: TokenType.WHILE,
  for: TokenType.FOR,
  in: TokenType.IN,

  unsafe: TokenType.UNSAFE,

  spawn: TokenType.SPAWN,

  pub: TokenType.PUB,
  use: TokenType.USE,
  mod: TokenType.MOD,
}

const isKeyword = (word) => word in KEYWORDS

const getToken = (word, line) => ({
  type: isKeyword(word) ? KEYWORDS[word] : TokenType.IDENT,
  value: word,
  line,
})

const isWhiteSpace = (ch) => ch === " " || ch === "\t"
const isNewLine = (ch) => ch === "\n" || ch === "\r"
const isDigit = (ch) => ch >= "0" && ch <= "9"
const isLetter = (ch) => (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z")

const isIdentStart = (ch) => isLetter(ch) || ch === "_" || ch === "$"
const isIdentPart = (ch) =>
  isLetter(ch) || isDigit(ch) || ch === "_" || ch === "$"

const singleCharTokens = {
  ".": TokenType.DOT,

  "(": TokenType.LPAREN,
  ")": TokenType.RPAREN,

  "{": TokenType.LBRACE,
  "}": TokenType.RBRACE,

  "[": TokenType.LBRACKET,
  "]": TokenType.RBRACKET,

  ",": TokenType.COMMA,
  ":": TokenType.COLON,
  ";": TokenType.SEMI,

  "=": TokenType.EQ,

  "+": TokenType.PLUS,
  "-": TokenType.MINUS,
  "*": TokenType.STAR,
  "/": TokenType.SLASH,
  "%": TokenType.PERCENT,

  ">": TokenType.GT,
  "<": TokenType.LT,
  "!": TokenType.BANG,

  "&": TokenType.AMP,
  "|": TokenType.PIPE,

  "^": TokenType.CARET,
  "~": TokenType.TILDE,

  "?": TokenType.QUESTION,
  "@": TokenType.AT,
  "#": TokenType.HASH,

  _: TokenType.UNDERSCORE,
}

const doubleCharTokens = {
  "++": TokenType.PLUS_PLUS,
  "--": TokenType.MINUS_MINUS,
  "==": TokenType.EQ_EQ,
  "!=": TokenType.BANG_EQ,
  ">=": TokenType.GT_EQ,
  "<=": TokenType.LT_EQ,
  "&&": TokenType.AND_AND,
  "||": TokenType.OR_OR,
  "=>": TokenType.FAT_ARROW,
  "->": TokenType.RIGHT_ARROW,
  "<-": TokenType.LEFT_ARROW,
  "..": TokenType.DOT_DOT,
  "::": TokenType.COLON_COLON,
  "//": TokenType.SLASH_SLASH,
}

function lexer(source) {
  let pos = 0
  let line = 1

  const peek = (offset = 0) => source[pos + offset]
  const eat = (size = 1) => (pos = pos + size)

  const tokens = []

  while (pos < source.length) {
    const ch = peek()
    if (isNewLine(ch)) {
      line++
      pos++
    } else if (isWhiteSpace(ch)) {
      pos++
    } else if (ch === "/" && peek(1) === "/") {
      while (pos < source.length && source[pos] !== "\n") {
        pos++
      }
    } else if (isIdentStart(ch)) {
      let word = ""
      while (pos < source.length && isIdentPart(source[pos])) {
        word += source[pos]
        pos++
      }

      if (word === "unsafe") {
        while (peek() !== "{") {
          eat()
        }
        eat() // eat opening brace — pos is now PAST the {
        let body = ""
        let depth = 1
        while (depth > 0) {
          if (pos >= source.length) throw new Error("Unterminated unsafe block")
          const ch = peek()
          if (ch === "{") depth++
          if (ch === "}") {
            depth--
            if (depth === 0) break
          }
          body += ch
          eat()
        }
        eat()
        tokens.push({ type: TokenType.UNSAFE, value: body, line })
      } else {
        tokens.push(getToken(word, line))
      }
    } else if (isDigit(ch)) {
      let word = ""
      while (pos < source.length && isDigit(source[pos])) {
        word += source[pos]
        pos++
      }
      tokens.push({
        type: TokenType.NUMBER,
        value: word,
        line,
      })
    } else {
      let double = pos + 1 < source.length ? ch + peek(1) : ch
      if (doubleCharTokens[double]) {
        let type = doubleCharTokens[double]

        tokens.push({ type, value: double, line })
        eat(2)
        continue
      } else {
        const type = singleCharTokens[ch]
        if (type) {
          tokens.push({ type, value: ch, line })
        } else if (ch === "'" || ch === '"') {
          let word = ""
          pos++
          while (pos < source.length && source[pos] !== ch) {
            word += source[pos]
            pos++
          }
          if (pos >= source.length)
            throw new Error(`Unterminated string at line ${line}`)
          pos++

          tokens.push({ type: TokenType.STRING, value: word, line })
          continue
        } else {
          throw new Error(`Character [${ch}] not supported yet!`)
        }
      }

      pos++
    }
  }

  tokens.push({ type: TokenType.EOF, value: "", line })

  return tokens
}

export { lexer }
