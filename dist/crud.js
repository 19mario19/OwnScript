class Request {
  constructor(method, path, body) {
    this.method = method
    this.path = path
    this.body = body
  }
}
class Response {
  constructor(status, body) {
    this.status = status
    this.body = body
  }
}
class User {
  constructor(id, name, email) {
    this.id = id
    this.name = name
    this.email = email
  }
}
function startServer(port, handler) {
  import("http").then(({ default: http }) => {
    const server = http.createServer((req, res) => {
      let chunks = []
      req.on("data", (chunk) => chunks.push(chunk))
      req.on("end", () => {
        const body = Buffer.concat(chunks).toString()
        const request = new Request(req.method, req.url, body)
        const response = handler(request)
        res.writeHead(response.status, { "Content-Type": "application/json" })
        res.end(response.body)
      })
    })
    server.listen(port)
  })
}
function createUser(id, name, email) {
  return new User(id, name, email)
}
function handleRequest(req) {
  if (req.method === "POST" && req.path === "/users") {
    const data = JSON.parse(req.body)
    const user = createUser(1, data.name, data.email)
    return new Response(201, JSON.stringify(user))
  }
  return new Response(404, JSON.stringify({ error: "not found" }))
}
startServer(3000, handleRequest)
