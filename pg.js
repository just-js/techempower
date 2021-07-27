const { createClient } = require('@tcp')
const { lookup } = require('@dns')
const md5 = require('../libs/pg/md5.js')

// COnstants
const constants = {
  AuthenticationMD5Password: 5,
  formats: {
    Text: 0,
    Binary: 1
  },
  fieldTypes: {
    INT4OID: 23,
    VARCHAROID: 1043
  },
  messageTypes: {
    AuthenticationOk: 82,
    ErrorResponse: 69,
    RowDescription: 84,
    CommandComplete: 67,
    ParseComplete: 49,
    CloseComplete: 51,
    BindComplete: 50,
    ReadyForQuery: 90,
    BackendKeyData: 75,
    ParameterStatus: 83,
    ParameterDescription: 116,
    DataRow: 68,
    NoData: 110
  }
}

const { INT4OID } = constants.fieldTypes
const messageNames = {}
Object.keys(constants.messageTypes).forEach(k => {
  messageNames[constants.messageTypes[k]] = k
})
constants.messageNames = messageNames

constants.BinaryInt = {
  format: constants.formats.Binary,
  oid: constants.fieldTypes.INT4OID
}

constants.VarChar = {
  format: constants.formats.Text,
  oid: constants.fieldTypes.VARCHAROID
}

const {
  AuthenticationOk,
  ErrorResponse,
  RowDescription,
  CommandComplete,
  ParseComplete,
  NoData,
  ReadyForQuery,
  CloseComplete
} = constants.messageTypes

// Protocol

function createParser (buf) {
  let nextRow = 0
  let parseNext = 0
  let parameters = {}
  const state = { start: 0, end: 0, rows: 0, running: false }

  //if (freeList.length) return freeList.shift()

  function onDataRow (len, off) {
    // D = DataRow
    if (nextRow === 0) state.start = off - 5
    nextRow++
    return off + len - 4
  }

  function onCommandComplete (len, off) {
    // C = CommandComplete
    state.end = off - 5
    state.rows = nextRow
    state.running = false
    off += len - 4
    nextRow = 0
    parser.onMessage()
    return off
  }

  function onCloseComplete (len, off) {
    // 3 = CloseComplete
    parser.onMessage()
    return off + len - 4
  }

  function onRowDescripton (len, off) {
    // T = RowDescription
    const fieldCount = dv.getInt16(off)
    off += 2
    fields.length = 0
    for (let i = 0; i < fieldCount; i++) {
      const name = readCString(buf, u8, off)
      off += name.length + 1
      const tid = dv.getInt32(off)
      off += 4
      const attrib = dv.getInt16(off)
      off += 2
      const oid = dv.getInt32(off)
      off += 4
      const size = dv.getInt16(off)
      off += 2
      const mod = dv.getInt32(off)
      off += 4
      const format = dv.getInt16(off)
      off += 2
      fields.push({ name, tid, attrib, oid, size, mod, format })
    }
    parser.onMessage()
    return off
  }

  function onAuthenticationOk (len, off) {
    // R = AuthenticationOk
    const method = dv.getInt32(off)
    off += 4
    if (method === constants.AuthenticationMD5Password) {
      parser.salt = buf.slice(off, off + 4)
      off += 4
      parser.onMessage()
    }
    return off
  }

  function onErrorResponse (len, off) {
    // E = ErrorResponse
    errors.length = 0
    let fieldType = u8[off++]
    while (fieldType !== 0) {
      const val = readCString(buf, u8, off)
      errors.push({ type: fieldType, val })
      off += (val.length + 1)
      fieldType = u8[off++]
    }
    parser.onMessage()
    return off
  }

  function onParameterStatus (len, off) {
    // S = ParameterStatus
    const key = readCString(buf, u8, off)
    off += (key.length + 1)
    const val = readCString(buf, u8, off)
    off += val.length + 1
    parameters[key] = val
    return off
  }

  function onParameterDescription (len, off) {
    // t = ParameterDescription
    const nparams = dv.getInt16(off)
    parser.params = []
    off += 2
    for (let i = 0; i < nparams; i++) {
      parser.params.push(dv.getUint32(off))
      off += 4
    }
    return off
  }

  function onParseComplete (len, off) {
    // 1 = ParseComplete
    off += len - 4
    parser.onMessage()
    return off
  }

  function onBindComplete (len, off) {
    // 2 = BindComplete
    off += len - 4
    parser.onMessage()
    state.rows = 0
    state.start = off
    state.running = true
    return off
  }

  function onReadyForQuery (len, off) {
    // Z = ReadyForQuery
    parser.status = u8[off]
    parser.onMessage()
    off += len - 4
    return off
  }

  function onBackendKeyData (len, off) {
    // K = BackendKeyData
    parser.pid = dv.getUint32(off)
    off += 4
    parser.key = dv.getUint32(off)
    off += 4
    parser.onMessage()
    return off
  }

  function parse (bytesRead) {
    let type
    let len
    let off = parseNext
    const end = buf.offset + bytesRead
    while (off < end) {
      const remaining = end - off
      let want = 5
      if (remaining < want) {
        if (byteLength - off < 1024) {
          if (state.running) {
            const queryLen = off - state.start + remaining
            just.error(`copyFrom 0 ${queryLen} ${state.start}`)
            buf.copyFrom(buf, 0, queryLen, state.start)
            buf.offset = queryLen
            parseNext = off - state.start
            state.start = 0
            return
          }
          just.error(`copyFrom 0 ${remaining} ${off}`)
          buf.copyFrom(buf, 0, remaining, off)
          buf.offset = remaining
          parseNext = 0
          return
        }
        buf.offset = off + remaining
        parseNext = off
        return
      }
      type = parser.type = dv.getUint8(off)
      len = parser.len = dv.getUint32(off + 1)
      want = len + 1
      if (remaining < want) {
        if (byteLength - off < 1024) {
          if (state.running) {
            const queryLen = off - state.start + remaining
            just.error(`copyFrom 0 ${queryLen} ${state.start}`)
            buf.copyFrom(buf, 0, queryLen, state.start)
            buf.offset = queryLen
            parseNext = off - state.start
            state.start = 0
            return
          }
          just.error(`copyFrom 0 ${remaining} ${off}`)
          buf.copyFrom(buf, 0, remaining, off)
          buf.offset = remaining
          parseNext = 0
          return
        }
        buf.offset = off + remaining
        parseNext = off
        return
      }
      off += 5
      off = (V[type] || V[0])(len, off)
    }
    parseNext = buf.offset = 0
  }

  function onDefault (len, off) {
    off += len - 4
    parser.onMessage()
    return off
  }

  function free () {
    parser.fields.length = 0
    parser.errors.length = 0
    parameters = parser.parameters = {}
    nextRow = 0
    parseNext = 0
    state.start = state.end = state.rows = 0
    state.running = false
    //freeList.push(parser)
  }

  const { messageTypes } = constants
  const dv = new DataView(buf)
  const u8 = new Uint8Array(buf)
  const byteLength = buf.byteLength
  const fields = []
  const errors = []
  const V = {
    [messageTypes.AuthenticationOk]: onAuthenticationOk,
    [messageTypes.ErrorResponse]: onErrorResponse,
    [messageTypes.RowDescription]: onRowDescripton,
    [messageTypes.CommandComplete]: onCommandComplete,
    [messageTypes.CloseComplete]: onCloseComplete,
    [messageTypes.ParseComplete]: onParseComplete,
    [messageTypes.BindComplete]: onBindComplete,
    [messageTypes.ReadyForQuery]: onReadyForQuery,
    [messageTypes.BackendKeyData]: onBackendKeyData,
    [messageTypes.ParameterStatus]: onParameterStatus,
    [messageTypes.ParameterDescription]: onParameterDescription,
    [messageTypes.DataRow]: onDataRow,
    0: onDefault
  }
  const parser = {
    buf,
    dv,
    u8,
    fields,
    parameters,
    type: 0,
    len: 0,
    errors,
    parse,
    free,
    state
  }
  return parser
}

// Messaging

function startupMessage ({ user, database, version = 0x00030000, parameters = [] }) {
  let len = 8 + 4 + 1 + user.length + 1 + 8 + 1 + database.length + 2
  for (let i = 0; i < parameters.length; i++) {
    const { name, value } = parameters[i]
    len += (name.length + 1 + value.length + 1)
  }
  const buf = new ArrayBuffer(len)
  const dv = new DataView(buf)
  let off = 0
  dv.setInt32(0, 0)
  off += 4
  dv.setInt32(4, version) // protocol version
  off += 4

  off += buf.writeString('user', off)
  dv.setUint8(off++, 0)
  off += buf.writeString(user, off)
  dv.setUint8(off++, 0)

  off += buf.writeString('database', off)
  dv.setUint8(off++, 0)
  off += buf.writeString(database, off)
  dv.setUint8(off++, 0)

  for (let i = 0; i < parameters.length; i++) {
    const { name, value } = parameters[i]
    off += buf.writeString(name, off)
    dv.setUint8(off++, 0)
    off += buf.writeString(value, off)
    dv.setUint8(off++, 0)
  }
  dv.setUint8(off++, 0)
  dv.setInt32(0, off)
  return buf
}

function md5AuthMessage ({ user, pass, salt }) {
  const token = `${pass}${user}`
  let hash = md5(token)
  const plain = new ArrayBuffer(36)
  plain.writeString(`md5${hash}`, 0)
  const plain2 = new ArrayBuffer(36)
  plain2.copyFrom(plain, 0, 32, 3)
  plain2.copyFrom(salt, 32, 4)
  hash = `md5${md5(plain2)}`
  const len = hash.length + 5
  let off = 0
  const buf = new ArrayBuffer(len + 1)
  const dv = new DataView(buf)
  dv.setUint8(off++, 112)
  dv.setUint32(off, len)
  off += 4
  off += buf.writeString(hash, off)
  dv.setUint8(off++, 0)
  return buf
}

// ACTIONS - Async/Promise Interface
function authenticate (sock, salt) {
  const { user, pass } = sock.config
  sock.write(md5AuthMessage({ user, pass, salt }))
  return new Promise(resolve => {
    sock.callbacks.push(resolve)
  })
}

function start (sock) {
  sock.write(startupMessage(sock.config))
  return new Promise(resolve => {
    sock.callbacks.push(resolve)
  })
}

function connect (config, buffer) {
  const { hostname, port } = config
  return new Promise((resolve, reject) => {
    lookup(hostname, (err, ip) => {
      if (err) {
        reject(err)
        return
      }
      let connected = false
      config.address = ip
      const sock = createClient(ip, port)
      sock.onClose = () => {
        if (!connected) reject(new Error('Could Not Connect'))
      }
      sock.onConnect = err => {
        if (err) {
          reject(err)
          return
        }
        connected = true
        resolve(sock)
        return buffer
      }
      sock.buffer = buffer
      sock.connect()
    })
  })
}

// Utilities
function readCString (buf, u8, off) {
  const start = off
  while (u8[off] !== 0) off++
  return buf.readString(off - start, start)
}

// External
async function createPool (config, poolSize, onConnect) {
  const connections = []
  for (let i = 0; i < poolSize; i++) {
    const sock = await connect(config, new ArrayBuffer(config.bufferSize))
    sock.config = config
    sock.callbacks = []
    sock.authenticated = false
    const parser = sock.parser = createParser(sock.buffer)
    parser.onMessage = function () {
      const { type } = parser
      //just.print(`message ${type} : ${messageNames[type]}, callbacks: ${sock.callbacks.length}`)
      if (type === CommandComplete) {
        sock.callbacks.shift()()
        return
      }
      if (type === CloseComplete) {
        sock.callbacks.shift()()
        return
      }
      if (type === ReadyForQuery) {
        if (!sock.authenticated) {
          sock.authenticated = true
          sock.callbacks.shift()()
        }
        return
      }
      if (type === ErrorResponse) {
        sock.callbacks.shift()(new Error(JSON.stringify(parser.errors, null, '  ')))
        return
      }
      if (type === RowDescription && !(sock.callbacks[0].isExec)) {
        sock.callbacks.shift()()
        return
      }
      if (type === AuthenticationOk || type === ParseComplete || type === NoData) {
        sock.callbacks.shift()()
      }
    }
    sock.onData = bytes => parser.parse(bytes)
    await start(sock)
    await authenticate(sock, parser.salt)
    onConnect(sock)
    connections.push(sock)
  }
  return connections
}

function compileQuery (sock, opts, onComplete) {
  const { callbacks } = sock
  const buf = new ArrayBuffer(24 * 1024) // TODO
  const { parser } = sock
  const rbuf = parser.buf
  const rdv = parser.dv
  const ru8 = parser.u8
  const dv = new DataView(buf)
  let len = 0
  const fun = {
    dv,
    size: 0,
    described: false,
    buffer: new ArrayBuffer(4096), // TODO
    params: opts.params || [],
    sql: opts.sql,
    formats: opts.formats || [],
    fields: opts.fields || [],
    name: opts.name || '',
    portal: opts.portal || '',
    maxRows: opts.maxRows || 0,
    messages: {
      prepare: { start: 0, len: 0 },
      bind: { start: 0, len: 0 },
      exec: { start: 0, len: 0 },
      describe: { start: 0, len: 0 },
      flush: { start: 0, len: 0 },
      close: { start: 0, len: 0 },
      sync: { start: 0, len: 0 }
    },
    paramStart: 0
  }
  const { name, sql, formats, fields, portal, maxRows } = fun
  fun.buffer.offset = 0
  fun.call = (onComplete, syncIt = true, flushIt = false) => {
    const { params } = fun
    let off = fun.paramStart
    // 32 bit integers only for now
    for (let i = 0; i < params.length; i++) {
      off += 4
      dv.setUint32(off, params[i])
      off += 4
    }
    const { bind, exec, flush, sync } = fun.messages
    off = bind.start
    let len = 0
    if (flushIt) {
      len = flush.start + flush.len - off
    } else if (syncIt) {
      len = sync.start + sync.len - off
    } else {
      len = exec.start + exec.len - off
    }
    const r = sock.write(buf, len, off)
    if (r < len) {
      just.error('short write')
      return false
    }
    callbacks.push(onComplete)
    return true
  }
  fun.append = (onComplete, syncIt = true, flushIt = false) => {
    const { params } = fun
    let off = fun.paramStart
    // 32 bit integers only for now
    for (let i = 0; i < params.length; i++) {
      off += 4
      dv.setUint32(off, params[i])
      off += 4
    }
    const { bind, exec, flush, sync } = fun.messages
    off = bind.start
    let len = 0
    if (flushIt) {
      len = flush.start + flush.len - off
    } else if (syncIt) {
      len = sync.start + sync.len - off
    } else {
      len = exec.start + exec.len - off
    }
    fun.buffer.offset += fun.buffer.copyFrom(buf, fun.buffer.offset, len, off)
    callbacks.push(onComplete)
  }
  fun.send = () => {
    const r = sock.write(fun.buffer, fun.buffer.offset, 0)
    if (r < len) {
      just.error(`short write offset ${fun.buffer.offset} r ${r} len ${len}`)
    }
    fun.buffer.offset = 0
  }
  fun.bind = (flushIt = true, onComplete) => {
    const { bind, flush } = fun.messages
    sock.write(buf, bind.len, bind.start)
    if (flushIt) {
      sock.write(buf, flush.len, flush.start)
    }
    callbacks.push(onComplete)
  }
  fun.close = (flushIt = true, onComplete) => {
    const { close, flush } = fun.messages
    sock.write(buf, close.len, close.start)
    if (flushIt) {
      sock.write(buf, flush.len, flush.start)
    }
    callbacks.push(onComplete)
  }
  fun.exec = (flushIt = true, onComplete) => {
    const { exec, flush } = fun.messages
    sock.write(buf, exec.len, exec.start)
    if (flushIt) {
      sock.write(buf, flush.len, flush.start)
    }
    callbacks.push(onComplete)
  }
  fun.prepare = (flushIt = true, onComplete) => {
    const { prepare, flush } = fun.messages
    sock.write(buf, prepare.len, prepare.start)
    if (flushIt) {
      sock.write(buf, flush.len, flush.start)
    }
    callbacks.push(onComplete)
  }
  fun.describe = (flushIt = true, onComplete) => {
    const { describe, flush } = fun.messages
    sock.write(buf, describe.len, describe.start)
    if (flushIt) {
      sock.write(buf, flush.len, flush.start)
    }
    callbacks.push(onComplete)
  }
  let off = 0
  // Prepare Message
  fun.messages.prepare.start = off
  len = 1 + 4 + sql.length + 1 + name.length + 1 + 2 + (formats.length * 4)
  dv.setUint8(off++, 80) // 'P'
  dv.setUint32(off, len - 1)
  off += 4
  off += buf.writeString(name, off)
  dv.setUint8(off++, 0)
  off += buf.writeString(sql, off)
  dv.setUint8(off++, 0)
  dv.setUint16(off, formats.length)
  off += 2
  for (let i = 0; i < formats.length; i++) {
    dv.setUint32(off, formats[i].oid)
    off += 4
  }
  fun.messages.prepare.len = off - fun.messages.prepare.start
  // Describe Message
  fun.messages.describe.start = off
  len = 7 + name.length
  dv.setUint8(off++, 68) // 'D'
  dv.setUint32(off, len - 1)
  off += 4
  dv.setUint8(off++, 83) // 'S'
  off += buf.writeString(name, off)
  dv.setUint8(off++, 0)
  fun.messages.describe.len = off - fun.messages.describe.start

  // Bind Message
  fun.messages.bind.start = off
  dv.setUint8(off++, 66) // 'B'
  off += 4 // length - will be filled in later
  if (portal.length) {
    off += buf.writeString(portal, off)
    dv.setUint8(off++, 0)
    off += buf.writeString(name, off)
    dv.setUint8(off++, 0)
  } else {
    dv.setUint8(off++, 0)
    off += buf.writeString(name, off)
    dv.setUint8(off++, 0)
  }
  dv.setUint16(off, formats.length || 0)
  off += 2
  for (let i = 0; i < formats.length; i++) {
    dv.setUint16(off, formats[i].format)
    off += 2
  }
  dv.setUint16(off, fun.params.length || 0)
  off += 2
  fun.paramStart = off
  for (let i = 0; i < fun.params.length; i++) {
    if ((formats[i] || formats[0]).format === 1) {
      dv.setUint32(off, 4)
      off += 4
      dv.setUint32(off, fun.params[i])
      off += 4
    } else {
      const paramString = fun.params[i].toString()
      dv.setUint32(off, paramString.length)
      off += 4
      off += buf.writeString(paramString, off)
    }
  }
  dv.setUint16(off, fields.length)
  off += 2
  for (let i = 0; i < fields.length; i++) {
    dv.setUint16(off, fields[i].format)
    off += 2
  }
  fun.messages.bind.len = off - fun.messages.bind.start
  dv.setUint32(fun.messages.bind.start + 1, fun.messages.bind.len - 1)
  // Exec Message
  fun.messages.exec.start = off
  len = 6 + portal.length + 4
  dv.setUint8(off++, 69) // 'E'
  dv.setUint32(off, len - 1)
  off += 4
  if (portal.length) {
    off += buf.writeString(portal, off)
  }
  dv.setUint8(off++, 0)
  dv.setUint32(off, maxRows)
  off += 4
  fun.messages.exec.len = off - fun.messages.exec.start
  // Sync Message
  fun.messages.sync.start = off
  dv.setUint8(off++, 83) // 'S'
  dv.setUint32(off, 4)
  off += 4
  fun.messages.sync.len = off - fun.messages.sync.start

  // Flush Message
  fun.messages.flush.start = off
  dv.setUint8(off++, 72) // 'H'
  dv.setUint32(off, 4)
  off += 4
  fun.messages.flush.len = off - fun.messages.flush.start

  // Close Statement Message
  fun.messages.close.start = off
  dv.setUint8(off++, 67) // 'C'
  dv.setUint32(off, 6 + name.length)
  off += 4
  dv.setUint8(off++, 83) // 'S'
  off += buf.writeString(name, off)
  dv.setUint8(off++, 0)
  fun.messages.close.len = off - fun.messages.close.start

  fun.size = off
  fun.buf = buf.slice(0, off)
  fun.getRows = () => {
    const { start, rows } = parser.state
    let off = start
    let f = fields
    if (!fields.length) f = opts.fields
    const result = []
    let i = 0
    let j = 0
    let row
    for (i = 0; i < rows; i++) {
      off += 5
      const cols = rdv.getUint16(off)
      off += 2
      row = Array(cols)
      result.push(row)
      for (j = 0; j < cols; j++) {
        len = rdv.getUint32(off)
        const { oid, format } = (f[j] || f[0])
        off += 4
        if (format === 0) { // Non-Binary
          if (oid === INT4OID) {
            row[j] = parseInt(rbuf.readString(len, off), 10)
          } else {
            row[j] = rbuf.readString(len, off)
          }
        } else {
          if (oid === INT4OID) {
            row[j] = rdv.getInt32(off)
          } else {
            row[j] = rbuf.slice(off, off + len)
          }
        }
        off += len
      }
      if (ru8[off] === 84) {
        len = rdv.getUint32(off + 1)
        off += len
      }
    }
    return result
  }
  if (!onComplete) return fun
  fun.prepare(true, err => {
    if (err) {
      onComplete(err, null)
      return
    }
    fun.describe(true, err => {
      if (err) {
        onComplete(err, null)
        return
      }
      onComplete(null, fun)
    })
  })
  return fun
}

function compile (sock, sql, name, fields = [], formats = [], params = [], maxRows = 1024) {
  const opts = { sql, formats, fields, params, name, maxRows }
  return new Promise((resolve, reject) => {
    compileQuery(sock, opts, (err, fun) => {
      if (err) {
        reject(err)
        return
      }
      resolve(fun)
    })
  })
}

const api = { connect, start, authenticate }

module.exports = { constants, createPool, compile }
