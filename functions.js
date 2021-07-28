const postgres = require('pg.js')
const { constants } = postgres
const { BinaryInt } = constants
const { dump } = require('@binary')

class Messaging {
  constructor (buffer, { formats, portal, name, params, fields, maxRows = 100 }) {
    this.buffer = buffer
    this.view = new DataView(buffer)
    this.bytes = new Uint8Array(buffer)
    this.off = 0
    this.formats = formats
    this.portal = portal
    this.name = name
    this.params = params
    this.fields = fields
    this.maxRows = maxRows
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
    // Bind Message
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

const query = {
  formats: [BinaryInt],
  portal: '',
  name: 's1',
  params: [1],
  fields: [BinaryInt]
}

const m = new Messaging(new ArrayBuffer(256), query)

const bind = m.createBindMessage()
m.off = bind.off
bind.set(255)
const exec = m.createExecMessage()
m.off = exec.off
const sync = m.createSyncMessage()
m.off = sync.off
const flush = m.createFlushMessage()
m.off = flush.off

just.print(dump(m.bytes))

function createBatchMessages (size) {
  const m = new Messaging(new ArrayBuffer(128 * size), query)
  const binds = []
  for (let i = 0; i < size; i++) {
    const bind = m.createBindMessage()
    binds.push(bind.set)
    m.off = bind.off
    const exec = m.createExecMessage()
    m.off = exec.off
  }
  const sync = m.createSyncMessage()
  m.off = sync.off
  const flush = m.createFlushMessage()
  m.off = flush.off
  return {
    call: (...args) => {
      args.forEach((a, i) => binds[i](...a))
    }
  }
}

module.exports = { create}
const mm = createBatchMessages(10)
just.print(dump(mm.bytes))
