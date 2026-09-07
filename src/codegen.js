import { ASTType } from "./types.js"
import { log } from "../helper.js"

function codegenMember(node) {
  if (node.kind === ASTType.Identifier) return codegen(node)
  return `${codegenMember(node.object)}.${node.property}`
}

function codegen(node, fileName) {
  if (!node) return
  if (!node?.kind) return
  if (node.typeParameters) {
    if (
      node.typeParameters?.length > 0 &&
      node.kind !== ASTType.TypeDeclaration
    ) {
      return
    }
  }
  switch (node.kind) {
    case ASTType.Program: {
      const imports = node.imports
        .map(
          (imp) =>
            `import * as ${imp.namespace.symbol} from "${imp.module.emit}"`,
        )
        .join(";\n")

      const body = node.body.map((statement) => codegen(statement)).join("\n")

      return [imports, body].filter(Boolean).join("\n")
    }

    case ASTType.FunctionDeclaration: {
      const params = node.params.map((p) => p.name).join(", ")
      const stmts = codegen(node.body)

      return `${node.async ? "async " : ""}function ${node.name}(${params}) {
${stmts}
}`
    }

    case ASTType.VariableDeclaration: {
      if (node.isParam) return

      return `let ${node.name} = ${node.async ? "await " : ""}${codegen(node.init)}`
    }

    case ASTType.ExportDeclaration: {
      return `export ${codegen(node.declaration)}`
    }

    case ASTType.ReturnStatement: {
      return `return ${codegen(node.argument)}`
    }

    case ASTType.CallExpression: {
      const args = node.args.map((arg) => codegen(arg.value)).join(", ")

      let calleeCode = ""
      if (node.callee.kind === ASTType.Identifier) {
        calleeCode = node.callee.value === "self" ? "this" : node.callee.value
      } else if (node.callee.kind === ASTType.MemberExpression) {
        calleeCode = codegenMember(node.callee)
      } else {
        calleeCode = codegen(node.callee)
      }

      return `${calleeCode}(${args})`
    }
    case ASTType.IfStatement: {
      const condition = codegen(node.condition)
      const consequent = codegen(node.consequent)

      if (node.alternate) {
        return `if (${condition}) {
${consequent}
} else {
${codegen(node.alternate)}
}`
      }

      return `if (${condition}) {
${consequent}
}`
    }

    case ASTType.SpawnStatement: {
      return `await ${codegen(node.argument)}`
    }

    case ASTType.PathExpression: {
      return `${node.path.join(".")}`
    }

    case ASTType.Identifier: {
      if (node.value === "self") return "this"
      return node.value
    }

    case ASTType.BlockStatement: {
      return node.body.map((stmt) => codegen(stmt)).join("\n")
    }

    case ASTType.NumberLiteral: {
      return node.value
    }

    case ASTType.StringLiteral: {
      return `"${node.value}"`
    }

    case ASTType.MoveExpression: {
      return `${node.value.value}`
    }

    // case ASTType.CloneExpression: {
    //   return `${node.value.value}`
    // }

    case ASTType.BinaryExpression: {
      return `${codegen(node.left)} ${node.op} ${codegen(node.right)}`
    }

    case ASTType.UnaryExpression: {
      return `${node.op}${codegen(node.operand)}`
    }

    case ASTType.AssignmentExpression: {
      return `${codegen(node.left)} ${node.op} ${codegen(node.right)}`
    }

    case ASTType.UpdateExpression: {
      return node.prefix
        ? `${node.op}${codegen(node.operand)}`
        : `${codegen(node.operand)}${node.op}`
    }

    case ASTType.BooleanLiteral: {
      return node.value
    }

    case ASTType.StructDeclaration: {
      const fields = node.fields.map((el) => el.name)

      return `class ${node.path.join("_")} {
constructor(${fields.join(", ")}) {
${fields.map((el) => `this.${el} = ${el}`).join("\n")}
}
}`
    }

    case ASTType.StructLiteral: {
      // log.stringify(node)

      return `new ${node.path.join("_")}(${node.fields
        .map((field) => codegen(field.value))
        .join(", ")})`
    }

    case ASTType.ImplBlock: {
      return node.methods
        .map((method) => {
          const name = method.name

          const params = method.params
            .filter((el) => el.name !== "self")
            .map((el) => el.name)
            .join(",")

          return `${node.name}${method.static ? "" : ".prototype"}.${name} = function(${params}) {
${codegen(method.body)}
}`
        })
        .join("\n")
    }

    case ASTType.ArrayExpression: {
      return `[${node.elements.map(codegen).join(",")}]`
    }

    case ASTType.ForStatement: {
      let iterable = `${codegen(node.iterable)}`
      return `
      for (let _index = 0; _index < ${iterable}.length; _index++ ) {
      const ${node.binding} = ${iterable}[_index]
${codegen(node.body)}
}`
    }

    case ASTType.UnsafeExpression: {
      if (node.async) {
        return `(async () => { ${node.body} })()`
      }

      log("node.body: ", node.body)
      return node.body
    }

    case ASTType.MemberExpression: {
      return codegenMember(node)
    }

    case ASTType.MethodDeclaration:
    case ASTType.TypeDeclaration: {
      const variants = node.variants
        .map((variant) => {
          const params = variant.params.map((_, i) => `value${i}`).join(", ")

          const values = variant.params.map((_, i) => `value${i}`).join(", ")

          return `${variant.name}(${params}){return {tag:"${variant.name}", value:[${values}]}}`
        })
        .join(",")

      return `const ${node.name}={${variants}}`
    }
    // case ASTType.VariantExpression: {
    //   const args = node.args.map((arg) => codegen(arg.value)).join(",")

    //   return `${node.name}(${args})`
    // }
    case ASTType.VariantPattern: {
    }
    case ASTType.WildcardPattern:
    case ASTType.MatchExpression: {
      const variantPatterns = node.arms.filter(
        (arm) => arm.pattern.kind === ASTType.VariantPattern,
      )

      const wildcard =
        node.arms.find((arm) => arm.pattern.kind === ASTType.WildcardPattern) ??
        null

      return `(()=> {
    const temp = ${codegen(node.subject)}
    switch(temp.tag) {
      ${variantPatterns
        .map((arm) => {
          const bindings = arm.pattern.bindings
            .map((binding, index) => `const ${binding} = temp.value[${index}]`)
            .join("\n")

          return `case "${arm.pattern.name.split("::").at(-1)}": {
            ${bindings}
            ${codegen(arm.body)}
          }`
        })
        .join("\n")}

      default:
        ${
          wildcard
            ? `return ${codegen(wildcard.body)}`
            : "throw new Error('Non-exhaustive match')"
        }
    }
  })()`
    }
    case ASTType.ClosureExpression: {
      const params = node.params.map((param) => param.name).join(", ")
      return `(${params}) => {
${codegen(node.body)}
}`
    }
    case ASTType.WhileStatement: {
      return `while (${codegen(node.condition)}) {
${codegen(node.body)}
}`
    }
    case ASTType.LoopStatement: {
      return `while (true) {
${codegen(node.body)}
}`
    }
    case ASTType.ContinueStatement: {
      return "continue"
    }
    case ASTType.BreakStatement: {
      return "break"
    }
    case ASTType.UseStatement: {
      // Ignore or lower to JS module imports depending on your stdlib design
      return ""
    }
    case ASTType.Param:
    case ASTType.Argument: {
      return
    }
  }
}

export { codegen }
