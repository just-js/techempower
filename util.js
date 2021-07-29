const { ANSI } = require('@binary')
const { AD, AG, AR, AB, AM, AC, AY } = ANSI

const ar = {}

for (let i = 1; i <= 100; i++) {
  ar[i] = (new Array(i)).fill(1)
}

const spray = (count, fn) => ar[count].map(fn)

const getMethods = (obj) => {
  const properties = new Set()
  let currentObj = obj
  do {
    Object.getOwnPropertyNames(currentObj).map(item => properties.add(item))
  } while ((currentObj = Object.getPrototypeOf(currentObj)))
  return [...properties.keys()].filter(item => typeof obj[item] === 'function')
}

function parse (text) {
  try {
    return JSON.parse(text)
  } catch (err) {
    return ''
  }
}

let memo = new Map()

function replacer (k, v) {
  try {
    if (typeof v === 'object') {
      if (memo.has(v)) return '<repeat>'
      memo.set(v)
    }
    if (typeof v === 'bigint') {
      return Number(v)
    }
    if (!v) {
      if (typeof v !== 'boolean' && typeof v !== 'number') return '<empty>'
    }
    if (v.constructor && v.constructor.name === 'ArrayBuffer') {
      return `ArrayBuffer [${v.byteLength}]`
    }
    if (v.constructor && v.constructor.name === 'Uint8Array') {
      return `Uint8Array [${v.length}]`
    }
  } catch (err) {
    just.error(`${AR}error in stringify replacer${AD}\n${err.stack}`)
  }
  return v
}

const stringify = (o, sp = '  ') => {
  memo = new Map()
  const text = JSON.stringify(o, replacer, sp)
  if (!text) return
  return text.replace(/\s{8}"(.+)":/g, `        ${AB}$1${AD}:`)
    .replace(/\s{6}"(.+)":/g, `      ${AC}$1${AD}:`)
    .replace(/\s{4}"(.+)":/g, `    ${AG}$1${AD}:`)
    .replace(/\s\s"(.+)":/g, `  ${AY}$1${AD}:`)
    .replace(/([{}])/g, `${AM}$1${AD}`)
    .replace(/\[(.+)\]/g, `${AG}[${AD}$1${AG}]${AD}`)
    .replace(/"<empty>"/g, `${AC}<empty>${AD}`)
    .replace(/"<repeat>"/g, `${AC}<repeat>${AD}`)
}

module.exports = { getMethods, stringify, parse, spray }
