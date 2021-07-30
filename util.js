const { ANSI } = require('@binary')
const postgres = require('pg.js')

const { AD, AG, AR, AB, AM, AC, AY } = ANSI

const { messageNames } = postgres.constants

// utility function for calling a function n times, up to 10000
const ar = [0]

for (let i = 1; i <= 100; i++) {
  ar[i] = (new Array(i)).fill(1)
}

const spray = (n, fn) => ar[n % 10000].map(fn)

// stringify replacer for pretty printing objects on console
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
/*
    if (v.constructor && v.constructor.name === 'Array') {
      return 'Array [' + v.length + ']: [' + v.slice(0, 3) + ']'
    }
*/
    if (v.constructor && v.constructor.name === 'ArrayBuffer') {
      return 'ArrayBuffer ' + v.byteLength
    }
    if (v.constructor && v.constructor.name === 'Uint8Array') {
      return 'Uint8Array ' + v.length
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

function toMB (v) {
  return `${AD}${Math.floor((Number(v) / (1024 * 1024)) * 100) / 100} ${AM}MB${AD}`
}

// stats monitor for server
function monitor (pool, server) {
  return just.setInterval(() => {
    const stat = { call: { send: 0, recv: 0 }, data: { send: 0, recv: 0 } }
    const parsers = []
    for (const sock of pool) {
      const { call, data } = sock.stats()
      stat.call.send += call.send
      stat.call.recv += call.recv
      stat.data.send += data.send
      stat.data.recv += data.recv
      const stats = sock.parser.stats()
      const o = {}
      Object.keys(stats).forEach(k => {
        o[messageNames[k]] = stats[k]
      })
      o.status = sock.parser.status
      o.state = sock.parser.state
      parsers.push(o)
    }
    const cpu = just.cpuUsage()
    const mem = just.memoryUsage()
    const { column } = ANSI.control
    just.print(ANSI.control.move(6, 0), false)
    just.print(ANSI.control.eraseLine(), false)
    just.print(`${AY}stat ${AG}call ${AC}send ${ANSI.control.column(18)}${AD}${stat.call.send} `, false)
    just.print(`${AC}recv ${ANSI.control.column(36)}${AD}${stat.call.recv} `, false)
    just.print(`${AG}data ${AC}send ${ANSI.control.column(54)}${AD}${stat.data.send} `, false)
    just.print(`${AC}recv ${ANSI.control.column(72)}${AD}${stat.data.recv} `, false)
    just.print(`\n${AY}cpu ${column(6)}${AC}user ${AD}${cpu.user} ${column(16)}${AC}system ${AD}${cpu.system}`, false)
    just.print(` ${AY}mem ${column(30)}${AC}rss ${AD}${toMB(mem.rss)} ${column(44)}${AC}external ${AD}${toMB(mem.external_memory)} ${column(64)}${AC}used-v8-heap ${AD}${toMB(mem.used_heap_size)}`, false)
    const pgstats = {
      bind: 0,
      command: 0,
      ready: 0,
      status: 0
    }
    for (const parser of parsers) {
      pgstats.bind += parser.BindComplete
      pgstats.command += parser.CommandComplete
      pgstats.ready += parser.ReadyForQuery
      pgstats.status = parser.status
    }
    just.print(`\n${AY}pg${AD}`, false)
    just.print(`${column(6)}${AM}bind${AD}${column(14)}${pgstats.bind}`, false)
    just.print(` ${AM}command${AD}${column(32)}${pgstats.command}`, false)
    just.print(` ${AM}ready${AD}${column(50)}${pgstats.ready}`, false)
    just.print(` ${AM}status${AD}${column(68)}${pgstats.status}`, false)
    just.print(`\n${AY}http${AD}`, false)
    just.print(`${column(6)}${AM}rps${AD}${column(14)}${server.rps}`, false)
    server.rps = 0
  }, 1000)
}

// console logger
const log = {
  first: str => {
    just.print(`${ANSI.control.cls()}${ANSI.control.home()}${str}`, false)
  },
  before: str => {
    just.print(str, false)
  },
  after: str => {
    just.print(`${ANSI.control.column(30)}${AG}OK${AD}\n${str}`, false)
  },
  only: str => {
    just.print(`\n${str}`, false)
  }
}

const error = {
  before: str => {
    just.print(str, false)
  },
  after: str => {
    just.print(`${AR}OK${AD}\n${str}`, false)
  }
}

module.exports = { stringify, spray, monitor, log, error }
