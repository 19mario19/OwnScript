const Result={Ok(value0){return {tag:"Ok", value:[value0]}},Err(value0){return {tag:"Err", value:[value0]}}}
let r = Result.Ok(22)
(()=> {
    const temp = r
    switch(temp.tag) {
      case "Ok": {
            const x = temp.value[0]
            return x
          }
case "Err": {
            const e = temp.value[0]
            return 0
          }

      default:
        throw new Error('Non-exhaustive match')
    }
  })()