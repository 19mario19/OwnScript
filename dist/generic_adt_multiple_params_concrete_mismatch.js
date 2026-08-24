


function makePair__number__string(a, b) {


return PairValue(a,b)
}
function PairValue(value){return {tag:"PairValue", value}}

let result = makePair__number__string(42,42)
