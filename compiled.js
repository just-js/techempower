module.exports.s1 = {
  read: function () {
  const { sock } = this
  const { state, dv, buf } = sock.parser
  const { start, rows } = state
  let off = start + 11
  if (rows === 1) {
    const id = dv.getInt32(off)
    off += 4
    const randomnumber = dv.getInt32(off)
    off += 4
    return { id, randomnumber }
  }
  const result = []
  off = start + 11
  for (let i = 0; i < rows; i++) {
    const id = dv.getInt32(off)
    off += 4
    const randomnumber = dv.getInt32(off)
    off += 4
    result.push({ id, randomnumber })
  }
  return result
},
  write: function () {
const { bindings, query, exec } = this
const { formats } = query
const { view, buffer } = exec
let next = 0
for (let args of batchArgs) {
  const { paramStart } = bindings[next + first]
  let off = paramStart
  view.setUint32(off + 4, args)
  off += 4
  next++
}
}
  }

module.exports.s2 = {
  read: function () {
  const { sock } = this
  const { state, dv, buf } = sock.parser
  const { start, rows } = state
  let off = start + 11
  if (rows === 1) {
    const id = dv.getInt32(off)
    off += 4
    const len = dv.getUint32(off)
    off += 4
    const message = buf.readString(len, off)
    off += len
    return { id, message }
  }
  const result = []
  off = start + 11
  for (let i = 0; i < rows; i++) {
    const id = dv.getInt32(off)
    off += 4
    const len = dv.getUint32(off)
    off += 4
    const message = buf.readString(len, off)
    off += len
    off += 11
    result.push({ id, message })
  }
  return result
},
  write: function () {

}
  }
