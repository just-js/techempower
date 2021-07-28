const { createClient } = require('@tcp')
const { lookup } = require('@dns')
const md5 = require('@md5')

// Constants
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

const { INT4OID, VARCHAROID } = constants.fieldTypes
const messageNames = {}
Object.keys(constants.messageTypes).forEach(k => {
  messageNames[constants.messageTypes[k]] = k
})
constants.messageNames = messageNames

constants.BinaryInt = {
  format: constants.formats.Binary,
  oid: INT4OID
}

constants.VarChar = {
  format: constants.formats.Text,
  oid: VARCHAROID
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
      // TODO: fix this
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
    just.print('poopoo')
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

const voidFn = () => {}

// Utilities
function readCString (buf, u8, off) {
  const start = off
  while (u8[off] !== 0) off++
  return buf.readString(off - start, start)
}

// External

async function createConnection (config, connections, onConnect) {
  const sock = await connect(config, new ArrayBuffer(config.bufferSize))
  const defaultAction = (...args) => sock.callbacks.shift()(...args)
  const actions = {
    [CommandComplete]: defaultAction,
    [CloseComplete]: defaultAction,
    [AuthenticationOk]: defaultAction,
    [ParseComplete]: defaultAction,
    [NoData]: defaultAction,
    [ReadyForQuery]: () => {
      if (!sock.authenticated) {
        sock.authenticated = true
        defaultAction()
      }
    },
    [ErrorResponse]: () => {
      defaultAction(new Error(JSON.stringify(parser.errors, null, '  ')))
    },
    [RowDescription]: () => {
      if (sock.callbacks[0].isExec) return
      defaultAction()
    }
  }
  sock.config = config
  sock.callbacks = []
  sock.authenticated = false
  const parser = sock.parser = createParser(sock.buffer)
  parser.onMessage = () => (actions[parser.type] || voidFn)()
  sock.onData = bytes => parser.parse(bytes)
  await start(sock)
  await authenticate(sock, parser.salt)
  connections.push(sock)
  await onConnect(sock)
}

async function createPool (config, poolSize, onConnect) {
  const connections = []
  for (let i = 0; i < poolSize; i++) {
    await createConnection(config, connections, onConnect)
  }
  return connections
}

class Messaging {
  constructor (buffer, { sql, formats, portal, name, params, fields, maxRows = 100 }) {
    this.buffer = buffer
    this.view = new DataView(buffer)
    this.bytes = new Uint8Array(buffer)
    this.off = 0
    this.sql = sql
    this.formats = formats
    this.portal = portal
    this.name = name
    this.params = params
    this.fields = fields
    this.maxRows = maxRows
    this.index = 0
  }

  createPrepareMessage (off = this.off) {
    const { view, buffer, formats, name, sql } = this
    const offsets = { start: 0, end: 0 }
    offsets.start = off
    const len = 1 + 4 + sql.length + 1 + name.length + 1 + 2 + (formats.length * 4)
    view.setUint8(off++, 80) // 'P'
    view.setUint32(off, len - 1)
    off += 4
    off += buffer.writeString(name, off)
    view.setUint8(off++, 0)
    off += buffer.writeString(sql, off)
    view.setUint8(off++, 0)
    view.setUint16(off, formats.length)
    off += 2
    for (let i = 0; i < formats.length; i++) {
      view.setUint32(off, formats[i].oid)
      off += 4
    }
    offsets.len = off - offsets.start
    return { off, offsets, len }
  }

  createDescribeMessage (off = this.off) {
    const { view, buffer, name } = this
    const offsets = { start: 0, end: 0 }
    offsets.start = off
    const len = 7 + name.length
    view.setUint8(off++, 68) // 'D'
    view.setUint32(off, len - 1)
    off += 4
    view.setUint8(off++, 83) // 'S'
    off += buffer.writeString(name, off)
    view.setUint8(off++, 0)
    offsets.len = off - offsets.start
    return { offsets, off, len }
  }

  createFlushMessage (off = this.off) {
    const { view } = this
    const offsets = { start: 0, end: 0 }
    offsets.start = off
    view.setUint8(off++, 72) // 'H'
    view.setUint32(off, 4)
    off += 4
    offsets.len = off - offsets.start
    return { off, offsets }
  }

  createSyncMessage (off = this.off) {
    const { view } = this
    const offsets = { start: 0, end: 0 }
    offsets.start = off
    view.setUint8(off++, 83) // 'S'
    view.setUint32(off, 4)
    off += 4
    offsets.len = off - offsets.start
    return { off, offsets }
  }

  createExecMessage (off = this.off) {
    const { view, buffer, portal, maxRows } = this
    const offsets = { start: 0, end: 0 }
    offsets.start = off
    const len = 6 + portal.length + 4
    view.setUint8(off++, 69) // 'E'
    view.setUint32(off, len - 1)
    off += 4
    if (portal.length) {
      off += buffer.writeString(portal, off)
    }
    view.setUint8(off++, 0)
    view.setUint32(off, maxRows)
    off += 4
    offsets.len = off - offsets.start
    return { len, off, offsets }
  }

  createBindMessage (off = this.off) {
    const { view, buffer, formats, portal, name, params, fields } = this
    const offsets = { start: 0, end: 0 }
    offsets.start = off
    view.setUint8(off++, 66) // 'B'
    off += 4 // length - will be filled in later
    if (portal.length) {
      off += buffer.writeString(portal, off)
      view.setUint8(off++, 0)
      off += buffer.writeString(name, off)
      view.setUint8(off++, 0)
    } else {
      view.setUint8(off++, 0)
      off += buffer.writeString(name, off)
      view.setUint8(off++, 0)
    }
    view.setUint16(off, formats.length || 0)
    off += 2
    for (let i = 0; i < formats.length; i++) {
      view.setUint16(off, formats[i].format)
      off += 2
    }
    view.setUint16(off, params.length || 0)
    off += 2
    const paramStart = off
    for (let i = 0; i < params.length; i++) {
      if ((formats[i] || formats[0]).format === 1) {
        view.setUint32(off, 4)
        off += 4
        view.setUint32(off, params[i])
        off += 4
      } else {
        const paramString = params[i].toString()
        view.setUint32(off, paramString.length)
        off += 4
        off += buffer.writeString(paramString, off)
      }
    }
    view.setUint16(off, fields.length)
    off += 2
    for (let i = 0; i < fields.length; i++) {
      view.setUint16(off, fields[i].format)
      off += 2
    }
    offsets.len = off - offsets.start
    view.setUint32(offsets.start + 1, offsets.len - 1)
    return {
      off,
      offsets,
      paramStart,
      set: (...args) => {
        let off = paramStart
        for (let i = 0; i < params.length; i++) {
          if ((formats[i] || formats[0]).format === 1) {
            view.setUint32(off + 4, args[i])
            off += 4
          } else {
            const paramString = args[i].toString()
            view.setUint32(paramStart, paramString.length)
            off += 4
            off += buffer.writeString(paramString, off)
          }
        }
      }
    }
  }
}

class Batch {
  constructor (sock, query, size) {
    this.sock = sock
    this.query = query
    this.size = size
    this.bindings = []
    this.exec = null
    this.prepare = null
    this.args = []
    this.first = 0
  }

  setup () {
    const { size, query, bindings } = this
    const m = new Messaging(new ArrayBuffer(128 * size), query)
    for (let i = 0; i < size; i++) {
      const bind = m.createBindMessage()
      bindings.push(bind)
      m.off = bind.off
      const exec = m.createExecMessage()
      m.off = exec.off
    }
    const sync = m.createSyncMessage()
    m.off = sync.off
    const flush = m.createFlushMessage()
    m.off = flush.off
    const p = new Messaging(new ArrayBuffer(256), query)
    const prepare = p.createPrepareMessage()
    p.off = prepare.off
    const describe = p.createDescribeMessage()
    p.off = describe.off
    this.exec = m
    this.prepare = p
    return this
  }

  set (args, first) {
    const { bindings } = this
    this.first = first
    this.args = args
    args.forEach((args, i) => bindings[i + first].set(args))
  }

  compile () {
    const { sock, prepare } = this
    sock.callbacks.push(voidFn)
    sock.callbacks.push(voidFn)
    const r = sock.write(prepare.buffer, prepare.off, 0)
    if (r <= 0) throw new just.SystemError('Could Not Prepare Queries')
    return this
  }

  async run (args) {
    const { sock, size, bindings, exec } = this
    const { buffer, off } = exec
    const n = args.length
    const first = size - n
    const { callbacks } = sock
    const promises = args.map((arg, i) => {
      bindings[i + first].set(arg)
      return new Promise((resolve, reject) => {
        callbacks.push(err => {
          if (err) {
            reject(err)
            return
          }
          const { state, dv } = sock.parser
          const { start, rows } = state
          if (rows === 1) {
            const id = dv.getInt32(start + 11)
            const randomnumber = dv.getInt32(start + 19)
            resolve({ id, randomnumber })
          }
        })
      })
    })
    if (n < size) {
      const start = bindings[first].offsets.start
      sock.write(buffer, exec.off - start, start)
    } else {
      sock.write(buffer, off, 0)
    }
    const results = await Promise.all(promises)
    return n === 1 ? results[0] : results
  }
}

async function createBatch (sock, query, size) {
  const batch = new Batch(sock, query, size)
  batch.setup()
  await batch.compile()
  return (...args) => batch.run(args)
}

module.exports = { constants, createPool, createBatch }
