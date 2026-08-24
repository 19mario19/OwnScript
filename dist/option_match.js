const Option={Some(value0){return {tag:"Some", value:[value0]}},None(){return {tag:"None", value:[]}}}
function getValue() {
return Option.Some(42)
}
let result = (()=> {
    const temp = getValue()
    switch(temp.tag) {
      case "Some": {
            const x = temp.value[0]
            return x
          }
case "None": {
            
            return 0
          }

      default:
        throw new Error('Non-exhaustive match')
    }
  })()