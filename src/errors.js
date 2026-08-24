function linePadding(line, maxLine) {
  return String(line).padStart(String(maxLine).length, " ")
}

class OwnScriptError extends Error {
  constructor(message, { line, source }) {
    super(message)
    this.line = line
    this.source = source
  }

  toString() {
    const lines = this.source.split("\n")
    const maxLine = lines.length

    const srcLine0 = lines[this.line - 2]
    const srcLine = lines[this.line - 1]
    const srcLine2 = lines[this.line]

    const padding = String(maxLine).length
    const empty = " ".repeat(padding)

    const currentLine = linePadding(this.line, maxLine)

    return (
      `[${this.constructor.name}] Line ${this.line}: ${this.message}\n` +
      `${empty} |\n` +
      `${currentLine} | ${srcLine}\n` +
      `${empty} |`
    )
  }
}
class ReferenceError extends OwnScriptError {}
class OwnershipError extends OwnScriptError {}
class MutabilityError extends OwnScriptError {}
class UseAfterMoveError extends OwnScriptError {}
class MutationError extends OwnScriptError {}
class ExportError extends OwnScriptError {}
class TypeError extends OwnScriptError {}

export {
  ReferenceError,
  OwnershipError,
  MutabilityError,
  UseAfterMoveError,
  MutationError,
  ExportError,
  TypeError,
}
