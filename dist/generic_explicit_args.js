function foo__number__string(a, b) {


return Result.Ok(a)
}
const Result={Ok(value0){return {tag:"Ok", value:[value0]}},Err(value0){return {tag:"Err", value:[value0]}}}

let result = foo__number__string(42, "hello")