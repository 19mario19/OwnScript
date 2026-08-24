const Result={Ok(value0){return {tag:"Ok", value:[value0]}},Err(value0){return {tag:"Err", value:[value0]}}}
let r = Result.Ok(42)
let result = (()=> {
    const temp = r
    switch(temp.tag) {
      case "Ok": {
            const x = temp.value[0]
            return x
          }

      default:
        return return 0
    }
  })()