const postgres = require('pg.js')

const { createPool, createBatch } = postgres
const config = require('techempower.config.js')
const { maxRandom, maxQuery, queries, db } = config

const getRandom = () => Math.ceil(Math.random() * maxRandom)
const spray = (n, fn) => [...Array(n)].map(fn)

async function main () {
  async function onConnect (sock) {
    const batch = await createBatch(sock, queries.worlds, maxQuery)
    sock.getWorldById = (...args) => batch.run(args)
  }
  const pool = await createPool(db, 1, onConnect)
  const world = await pool[0].getWorldById(getRandom())
  just.print(JSON.stringify(world))
  const worlds = await pool[0].getWorldById(...spray(10, getRandom))
  just.print(JSON.stringify(worlds))
}

main().catch(err => just.error(err.stack))
