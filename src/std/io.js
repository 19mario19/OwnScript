function print(data) {
  ;(() => {
    console.log(data)
  })()
}
const io = { print }
export { io }
