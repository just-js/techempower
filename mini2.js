const justify = require('@justify')
const postgres = require('pg.js')

async function setup (sock) {
  const { worlds } = queries
  const worldsQuery = await sock.createQuery(worlds, maxQuery).setup().generate().compile().create()
  sock.getWorldById = id => worldsQuery.run([id])
}

const getRandom = () => Math.ceil(Math.random() * maxRandom)

const config = require('techempower.config.js')
const { connect } = postgres
const { createServer } = justify
const { maxRandom, maxQuery, server, queries, db } = config
const { port, address } = server
const poolSize = parseInt(just.env().PGPOOL || just.sys.cpus, 10)

let next = 0

async function main (args) {
  const pool = await connect(db, poolSize)
  await Promise.all(pool.map(sock => setup(sock)))
  const server = createServer()
    .default(async (req, res) => {
      const { getWorldById } = res.socket.db
      res.json(JSON.stringify(await getWorldById(getRandom())))
    })
    .connect(sock => {
      sock.db = pool[next++ % poolSize]
    })
    .listen(port, address)
  server.name = config.server.name
}

main(just.args.slice(2)).catch(err => just.error(err.stack))
