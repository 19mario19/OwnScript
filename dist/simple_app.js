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
      case "Quit": {
        return Result.Err("quit")
      }

      default:
        throw new Error("Non-exhaustive match")
    }
  })()
  return result
}
function main() {
  let command = Command.Add(10, 20)
  let result = (() => {
    const temp = execute(command)
    switch (temp.tag) {
      case "Ok": {
        const value = temp.value[0]
        return value
      }
      case "Err": {
        const message = temp.value[0]
        return 0
      }

      default:
        throw new Error("Non-exhaustive match")
    }
  })()

  console.log(result)
}
main()
