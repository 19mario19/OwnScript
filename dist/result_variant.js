const Result={Ok(value0){return {tag:"Ok", value:[value0]}},Err(value0){return {tag:"Err", value:[value0]}}}
function test() {
let x = Result.Ok(42)
return x
}
function test2() {
let x = Result.Err("42")
return x
}