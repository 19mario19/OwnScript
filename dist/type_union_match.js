function Ok(value){return {tag:"Ok", value}}
function Err(value){return {tag:"Err", value}}
function getUser(id) {

if (id > 0) {
return Ok(id)
}
return Err("not found")
}
let result = (()=>{
    const temp = getUser(1)
    switch(temp.tag){
      case "Ok":{
            const x = temp.value
            return x
          }
case "Err":{
            const e = temp.value
            return 0
          }
      default:
        throw new Error('Non-exhaustive match')
    }
  })()