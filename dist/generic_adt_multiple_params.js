function makePair__number__string(a, b) {


return PairValue(a, b)
}
const Pair={PairValue(value0, value1){return {tag:"PairValue", value:[value0, value1]}}}

let result = makePair__number__string(42, "hello")