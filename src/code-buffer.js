class Writer {
  constructor(buffer) {
    this.buffer = buffer
  }

  addLine(value) {
    this.buffer += value + "\n"
  }

  add(value) {
    this.buffer += value
  }
}

class CodeBuffer {
  constructor(buffer) {
    this.buffer = new Writer(buffer)
  }
}



