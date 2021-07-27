const justify = require('../libs/justify/justify.js')
const config = require('config.js')
const postgres = require('../libs/pg/pg.js')
const html = require('../libs/html/html.js')

const { createServer } = justify
const { compile, createConnectionPool, pg } = postgres
const { BinaryInt, VarChar } = pg
const { port, address } = config.server
const { templates } = config

async function setupConnection (db) {
  db.getFortunes = await compile(db, 'select * from Fortune',
    's2', [BinaryInt, VarChar], [], [], true, false)
}

async function main () {
  const poolSize = parseInt(just.env().PGPOOL || just.sys.cpus, 10)
  const extra = [0, 'Additional fortune added at request time.']
  const fortunes = html.load(templates.fortunes2, templates.settings)
  const clients = await createConnectionPool(config.db, poolSize, setupConnection)

  function sortByMessage (a, b) {
    if (a[1] > b[1]) return 1
    if (a[1] < b[1]) return -1
    return 0
  }

  const server = createServer()
    .get('/', (req, res) => res.text(''))
    .get('/fortunes', (req, res) => {
      const { getFortunes } = res.socket
      getFortunes.call(err => {
        if (err) return server.serverError(req, res, err)
        res.html(fortunes.call({ row: [extra, ...getFortunes.getRows()].sort(sortByMessage) }))
      })
    })
    .connect(sock => {
      const client = clients[sock.fd % clients.length]
      sock.getFortunes = client.getFortunes.query
    })
    .listen(port, address)
}

main().catch(err => just.error(err.stack))
