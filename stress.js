const postgres = require('@pg')
const config = require('tfb.config.js')

const { connect } = postgres
const { BinaryInt } = postgres.constants
const { runMicroTasks } = just.sys

const getRandom = () => Math.ceil(Math.random() * 10000)

async function main () {
  const sock = (await connect(config.db))[0]
  const maxQuery = 4096
  const worlds = await sock.compile({
    name: '',
    sql: 'select id, randomNumber from World where id = $1',
    fields: [
      { format: BinaryInt, name: 'id' },
      { format: BinaryInt, name: 'randomnumber' }
    ],
    params: 1,
    formats: [BinaryInt]
  }, maxQuery)
  let qps = 0
  let run = 0
  just.setInterval(() => {
    just.print(`${next.name} qps ${qps} pending ${worlds.pending} syncing ${worlds.syncing} queue ${sock.queueSize()}`)
    qps = 0
    if (++run % 5 === 0) {
      run = 0
      next = (next === single ? batch : single)
    }
  }, 1000)
  const { loop } = just.factory
  const { params } = worlds.query
  params[0] = getRandom()
  function incr () {
    qps++
  }
  function single () {
    while (worlds.syncing < 2048) worlds.runSingle().then(incr)
    loop.poll(-1)
    just.sys.nextTick(next)
    runMicroTasks()
  }
  const ids = (new Array(20)).fill(0)
  function batch () {
    while (worlds.syncing < 256) worlds.runBatch(ids.map(getRandom)).then(incr)
    loop.poll(-1)
    just.sys.nextTick(next)
    runMicroTasks()
  }
  let next = single
  next()
}

main().catch(err => just.error(err.stack))
