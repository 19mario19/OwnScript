const Result = {
  Ok(value0) {
    return { tag: "Ok", value: [value0] }
  },
  Err(value0) {
    return { tag: "Err", value: [value0] }
  },
}
const Command = {
  Add(value0, value1) {
    return { tag: "Add", value: [value0, value1] }
  },
  Mul(value0, value1) {
    return { tag: "Mul", value: [value0, value1] }
  },
  Sub(value0, value1) {
    return { tag: "Sub", value: [value0, value1] }
  },
  Div(value0, value1) {
    return { tag: "Div", value: [value0, value1] }
  },
  Quit() {
    return { tag: "Quit", value: [] }
  },
}
function execute(command) {
  let result = (() => {
    const temp = command
    switch (temp.tag) {
      case "Add": {
        const a = temp.value[0]
        const b = temp.value[1]
        return Result.Ok(a + b)
      }
      case "Mul": {
        const a = temp.value[0]
        const b = temp.value[1]
        return Result.Ok(a * b)
      }
      case "Sub": {
        const a = temp.value[0]
        const b = temp.value[1]
        return Result.Ok(a - b)
      }
      case "Div": {
        const a = temp.value[0]
        const b = temp.value[1]
        return Result.Ok(a / b)
      }
      case "Quit": {
        return Result.Err("Quit!")
      }

      default:
        throw new Error("Non-exhaustive match")
    }
  })()
  return result
}
function main() {
  let command = Command.Add(10, 10)
  let result = (() => {
    const temp = execute(command)
    switch (temp.tag) {
      case "Ok": {
        const res = temp.value[0]
        return res
      }
      case "Err": {
        const err = temp.value[0]
        return 0
      }

      default:
        throw new Error("Non-exhaustive match")
    }
  })()

  console.log(result)
}
main()
