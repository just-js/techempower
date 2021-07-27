const stringify = require('@stringify')
const justify = require('@justify')
const postgres = require('pg.js')
const config = require('techempower.config.js')

const { createPool, compile, constants } = postgres
const { BinaryInt } = constants
const { createServer } = justify
const { sjs, attr } = stringify
const { maxRandom, maxQuery } = config
const { port, address } = config.server

const getRandom = () => Math.ceil(Math.random() * maxRandom)
const getCount = qs => Math.min(parseInt((qs.q) || 1, 10), maxQuery) || 1

async function onConnect (sock) {
  sock.getWorldById = await compile(sock,
    'select id, randomNumber from World where id = $1', 's1',
    [BinaryInt], [BinaryInt], [1], false, false)
}

async function main () {
  const sDB = sjs({ id: attr('number'), randomnumber: attr('number') })
  const poolSize = parseInt(just.env().PGPOOL || just.sys.cpus, 10)
  const connections = await createPool(config.db, poolSize, onConnect)
  const server = createServer()
    .get('/db', async (req, res) => {
      res.json(sDB(await res.socket.getWorldById(getRandom())))
    })
    .get('/query', async (req, res) => {
      const { getWorldById } = res.socket
      const count = getCount(req.query)
      const worlds = []
      for (let i = 0; i < count; i++) {
        worlds.push(getWorldById(getRandom()))
      }
      res.json(JSON.stringify(await Promise.all(worlds)))
    }, { qs: true })
    .connect(sock => {
      const connection = connections[sock.fd % poolSize]
      const { getWorldById } = connection
      sock.getWorldById = id => new Promise(resolve => {
        getWorldById.params[0] = id
        getWorldById.call(() => {
          const [id, randomnumber] = getWorldById.getRows()[0]
          resolve({ id, randomnumber })
        }, true)
      })
    })
    .listen(port, address)
  server.name = 'j'
  server.stackTraces = true
}

main().catch(err => just.error(err.stack))
