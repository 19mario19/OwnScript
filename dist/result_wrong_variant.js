const Result={Ok(value0){return {tag:"Ok", value:[value0]}},Err(value0){return {tag:"Err", value:[value0]}}}
const Option={Some(value0){return {tag:"Some", value:[value0]}},None(){return {tag:"None", value:[]}}}
function getValue() {
return Option.Some(42)
}