export class Client {
  constructor() {}
}
Client.new = function () {
  return new Client()
}
Client.get = function (URL) {
  return (async () => {
    let res = await fetch(URL)
    let json = await res.json()
    return json
  })()
}
Client.post = function (URL, body) {
  return (async () => {
    let res = await fetch(URL, {
      method: "POST",
      body: JSON.stringify(body),
    })
    let json = await res.json()
    return json
  })()
}
