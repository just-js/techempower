const tcp = require('@tcp')
// https://redis.io/topics/protocol

class Parser {
  constructor (buffer) {
    this.buffer = buffer
    this.off = 0
    this.size = buffer.byteLength
    this.u8 = new Uint8Array(buffer)
    this.onMessage = () => {}
    this.message = { type: 0, val: [], text: [], start: 0 }
    this.inHeader = true
    this.pos = 0
  }

  parse (bytes, off = this.off) {
    const { buffer } = this
    while (bytes--) {
      const c = this.u8[off++]
      if (c === 13) continue
      if (c === 10) {
        if (this.inHeader) {
          if (this.message.type === 43) {
            this.message.text = this.message.val.map(c => String.fromCharCode(c)).join('')
            delete this.message.val
            delete this.message.start
            this.onMessage(this.message)
            this.message = { type: 0, val: [], text: [], start: 0 }
            this.pos = 0
          } else if (this.message.type === 36) {
            const len = this.message.val.length
            if (this.message.val[0] === 45) {
              this.message.size = this.message.val.slice(1).reduceRight((p, c, i) => {
                p += Math.pow(10, (len - i) - 2) * (c - 48)
                return p
              }, 0) * -1
              delete this.message.text
            } else {
              this.message.size = this.message.val.reduceRight((p, c, i) => {
                p += Math.pow(10, (len - i) - 1) * (c - 48)
                return p
              }, 0)
            }
            if (this.message.size > 0) {
              this.inHeader = false
              this.message.start = off
              this.pos = 0
              continue
            }
            delete this.message.val
            delete this.message.start
            this.onMessage(this.message)
            this.message = { type: 0, val: [], text: [], start: 0 }
            this.pos = 0
          }
        }
        continue
      }
      if (this.inHeader) {
        if (this.pos === 0) {
          this.message.type = c
        } else {
          this.message.val.push(c)
        }
        this.pos++
        continue
      }
      this.pos++
      if (this.pos >= this.message.size) {
        this.message.text.push(buffer.readString(this.pos, this.message.start))
        this.message.text = this.message.text.join('')
        delete this.message.val
        delete this.message.start
        this.onMessage(this.message)
        this.message = { type: 0, val: [], text: [], start: 0 }
        this.pos = 0
        this.inHeader = true
      }
    }
    if (this.pos > 0) {
      just.print('that\'s no good')
    }
    this.off = 0
  }
}

class RedisClient {
  constructor (port = 6379, address = '127.0.0.1', bufferSize = 65536) {
    this.port = port
    this.address = address
    this.connected = false
    this.sock = null
    this.prefix = 'key.'
    this.prefixLen = 4
    this.bufferSize = bufferSize
    this.buffer = new ArrayBuffer(bufferSize)
    this.recv = 0
    this.send = 0
    this.callbacks = []
    this.parser = new Parser(this.buffer)
    this.parser.onMessage = message => this.callbacks.shift()(message)
  }

  connect (onConnect) {
    const client = this
    const { address, port, buffer } = client
    const sock = this.sock = tcp.createClient(address, port)
    this.sock.onConnect = s => {
      client.connected = true
      sock.setNoDelay(1)
      sock.setKeepAlive(1)
      onConnect()
      return buffer
    }
    this.sock.onClose = () => {
      client.connected = false
    }
    this.sock.onData = bytes => {
      client.recv += bytes
      client.parser.parse(bytes)
    }
    return sock.connect()
  }

  put (key, val, callback) {
    if (!this.connected) throw new Error('Not Connected')
    const { prefix, prefixLen } = this
    const size = String.byteLength(val)
    const keySize = String.byteLength(key) + prefixLen
    const r = this.sock.writeString(`*3\r\n$3\r\nSET\r\n$${keySize}\r\n${prefix}${key}\r\n$${size}\r\n${val}\r\n`)
    if (r === 0) {
      this.sock.close()
      return r
    }
    if (r < 0) {
      if (just.sys.errno() === just.sys.EAGAIN) return r
      this.sock.close()
      return r
    }
    this.callbacks.push(callback)
    this.send += r
    return r
  }

  get (key, callback) {
    if (!this.connected) throw new Error('Not Connected')
    const { prefix, prefixLen } = this
    const keySize = String.byteLength(key) + prefixLen
    const r = this.sock.writeString(`*2\r\n$3\r\nGET\r\n$${keySize}\r\n${prefix}${key}\r\n`)
    if (r === 0) {
      this.sock.close()
      return r
    }
    if (r < 0) {
      if (just.sys.errno() === just.sys.EAGAIN) return r
      this.sock.close()
      return r
    }
    this.callbacks.push(callback)
    this.send += r
    return r
  }
}

module.exports = { createClient: (...args) => new RedisClient(...args) }
