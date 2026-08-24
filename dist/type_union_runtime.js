const Result={Ok(value0){return {tag:"Ok", value:[value0]}},Err(value0){return {tag:"Err", value:[value0]}}}
let result = Result.Ok(42)
let error = Result.Err("something went wrong")