
      
      async function get(URL){

return (async ()=>{
        let res = await fetch(URL)
        let json = await res.json()
        return json
    })()
}
async function post(URL, body){


return (async ()=>{
        let res = await fetch(URL, 
        {
            method: "POST",
            body: JSON.stringify(body)
            }
        )
        let json = await res.json()
        return json
    })()
}
let CONSTANT =  12345
      const http = {get,post,CONSTANT}
      export {http}
      