const Result={Ok(value0){return {tag:"Ok", value:[value0]}},Err(value0){return {tag:"Err", value:[value0]}}}
function getValue() {
return Result.Ok(42)
}