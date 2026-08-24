const Result = {
  Ok(value0) {
    return { tag: "Ok", value: [value0] }
  },
  Err(value0) {
    return { tag: "Err", value: [value0] }
  },
}
function check(value) {
  if (value > 0) {
    return Ok(value)
  }
  return Err("invalid")
}
let result = (() => {
  const temp = check(10)
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
