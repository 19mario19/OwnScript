import { log } from "../helper.js"
import { TypeRegistryKind } from "./types.js"

class SymbolTable {
  #table = new Map()

  get() {
    return this.#table
  }

  debug() {
    log.stringify("SYMBOL TABLE\n", this.#table)
  }

  preventDuplicate(path) {
    if (this.#table.has(path.join("::"))) {
      throw new Error(`Duplicate [${path.join("::")}] has been detected.`)
    }
  }

  register(path, symbol, pathPrefix = []) {
    const fullPath = [...pathPrefix, ...path]
    this.preventDuplicate(fullPath)
    this.#table.set(fullPath.join("::"), symbol)
  }

  resolve(path) {
    // log("trying to resolve SYMBOL: ", path)
    return this.#table.get(path.join("::")) ?? null
  }

  has(path) {
    return this.#table.has(path.join("::"))
  }
}

class ScopeStack {
  #scopes = []
  constructor(init = [new Map()]) {
    this.#scopes = init.map((scope) => new Map(scope))
  }

  push() {
    this.#scopes.push(new Map())
  }
  pop() {
    this.#scopes.pop()
  }
  declare(name, binding) {
    this.#scopes.at(-1).set(name, binding)
  }

  get() {
    return this.#scopes
  }

  has(name) {
    for (let i = this.#scopes.length - 1; i >= 0; i--) {
      if (this.#scopes[i].has(name)) return true
    }
    return false
  }

  clone() {
    return new ScopeStack(this.#scopes)
  }

  get currentScope() {
    return this.#scopes.at(-1)
  }

  update(name, update) {
    this.currentScope.set(name, {
      ...this.currentScope.get(name),
      state: update,
    })
  }

  lookup(name) {
    for (let i = this.#scopes.length - 1; i >= 0; i--) {
      if (this.#scopes[i].has(name)) return this.#scopes[i].get(name)
    }
    return null
  }

  debug() {
    log.stringify("SCOPE STACK:\n", this.#scopes)
  }
}

class TypeRegistry {
  #types = new Map()
  #typeParamsScopes = []
  #traits = new Map()

  // traits
  seedTraits() {
    this.#traits.set("Copy", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number", "bool"],
    })
    this.#traits.set("Clone", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number", "bool", "string"],
    })
    this.#traits.set("Eq", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number", "bool", "string"],
    })
    this.#traits.set("Add", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number", "string"],
    })
    this.#traits.set("Display", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number", "bool", "string"],
    })
    // Missing Traits & Implementations
    this.#traits.set("Sub", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number"],
    })

    this.#traits.set("Mul", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number"],
    })

    this.#traits.set("Div", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number"],
    })

    this.#traits.set("Rem", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number"],
    })

    this.#traits.set("BitAnd", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number", "bool"],
    })

    this.#traits.set("BitOr", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number", "bool"],
    })

    this.#traits.set("BitXor", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number", "bool"],
    })

    this.#traits.set("Shl", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number"],
    })

    this.#traits.set("Shr", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number"],
    })

    this.#traits.set("PartialEq", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number", "bool", "string"],
    })

    this.#traits.set("PartialOrd", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number", "string"],
    })

    // Compound Assignment Traits
    this.#traits.set("AddAssign", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number", "string"],
    })

    this.#traits.set("SubAssign", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number"],
    })

    this.#traits.set("MulAssign", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number"],
    })

    this.#traits.set("DivAssign", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number"],
    })

    this.#traits.set("RemAssign", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number"],
    })

    this.#traits.set("BitAndAssign", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number", "bool"],
    })

    this.#traits.set("BitOrAssign", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number", "bool"],
    })

    this.#traits.set("BitXorAssign", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number", "bool"],
    })

    this.#traits.set("ShlAssign", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number"],
    })

    this.#traits.set("ShrAssign", {
      kind: "TRAIT",
      builtin: true,
      implementors: ["number"],
    })
  }

  addTrait(name, implementors = []) {
    this.#traits.set(name, {
      kind: "TRAIT",
      builtin: false,
      implementors,
    })
  }

  hasTrait(name) {
    return this.#traits.has(name)
  }

  getTrait(name) {
    return this.#traits.get(name) ?? null
  }

  // does user implement clone?
  implements(typeName, traitName) {
    const trait = this.#traits.get(traitName)
    if (!trait) throw new Error(`Unknown trait "${traitName}"`)
    return trait.implementors.includes(typeName)
  }

  // register - user now implementors clone
  addImpl(typeName, traitName) {
    const trait = this.#traits.get(traitName)
    if (!trait) throw new Error(`Unknown trait "${traitName}"`)
    trait.implementors.push(typeName)
  }

  // type params <T,U>
  push(params) {
    const scope = new Set(params.map((p) => p.name))
    this.#typeParamsScopes.push(scope)
  }

  pop() {
    this.#typeParamsScopes.pop()
  }

  isTypeParam(name) {
    for (let i = this.#typeParamsScopes.length - 1; i >= 0; i--) {
      if (this.#typeParamsScopes[i].has(name)) return true
    }
    return false
  }

  isValidType(name) {
    return this.#types.has(name) || this.isTypeParam(name)
  }

  // original
  seed() {
    this.#types.set("number", {
      kind: TypeRegistryKind.PRIMITIVE,
      builtin: true,
    })
    this.#types.set("string", {
      kind: TypeRegistryKind.PRIMITIVE,
      builtin: true,
    })
    this.#types.set("void", { kind: TypeRegistryKind.PRIMITIVE, builtin: true })
    this.#types.set("bool", { kind: TypeRegistryKind.PRIMITIVE, builtin: true })
  }

  register(name, type) {
    this.#types.set(name, type)
  }

  get() {
    return this.#types
  }

  has(name) {
    return this.#types.has(name)
  }

  resolve(type) {
    // log.stringify("TYPE trying to resolve ", type)
    // log("1", type)
    return this.#types.get(type.name) ?? null
  }

  debug() {
    log.stringify("TYPE MAP:\n", this.#types)
    log.stringify("TRAITS MAP:\n", this.#traits)
    log.stringify("TYPE PARAMS SCOPES:\n", this.#typeParamsScopes)
  }
}

export { SymbolTable, ScopeStack, TypeRegistry }
