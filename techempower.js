// requires
const justify = require('@justify')
const postgres = require('@pg')
const html = require('@html')
const util = require('util.js')
const config = require('techempower.config.js')

// namespace imports
const { connect } = postgres
const { createServer } = justify
const { maxRandom, maxQuery, httpd, queries, db, templates } = config
const { port, address } = httpd
const { spray, generateBulkUpdate, sortByMessage } = util

// helper functions
const getRandom = () => Math.ceil(Math.random() * maxRandom)
const getCount = qs => Math.min(parseInt(((qs || {}).q) || 1, 10), maxQuery) || 1

// async main. any exceptions will be caught in the handler below
async function main () {
  const poolSize = parseInt(just.env().PGPOOL || just.sys.cpus, 10)
  const extra = { id: 0, message: 'Additional fortune added at request time.' }
  const message = 'Hello, World!'
  const json = { message }
  const template = html.load(templates.fortunes, templates.settings)

  // create connection pool and await connections
  const pool = await connect(db, poolSize)

  // compile and prepare sql statements when we connect to each database
  await Promise.all(pool.map(async sock => {
    const { worlds, fortunes } = queries
    const U = [{ run: () => Promise.resolve([]) }]
    const fortunesQuery = await sock.create(fortunes, maxQuery)
    const worldsQuery = await sock.create(worlds, maxQuery)
    for (let i = 1; i <= maxQuery; i++) {
      const update = generateBulkUpdate('world', 'randomnumber', 'id', i)
      const bulk = Object.assign(queries.update, update)
      U.push(await sock.create(bulk))
    }
    sock.getAllFortunes = () => fortunesQuery.run()
    sock.getWorldById = id => worldsQuery.run([id])
    sock.getWorldsById = ids => worldsQuery.run(ids)
    sock.updateWorlds = w => U[w.length].run([w.flatMap(w => [w.id, w.randomnumber])])
  }))

  // the connection pool is created and bootstrapped, set up the web server
  const server = createServer(httpd)
    .get('/update', async (req, res) => {
      const { getWorldsById, updateWorlds } = res.socket.db
      const worlds = await getWorldsById(spray(getCount(req.query), getRandom))
      worlds.forEach(r => (r.randomnumber = getRandom()))
      await updateWorlds(worlds)
      res.json(JSON.stringify(worlds))
    }, { qs: true })
    .get('/db', async (req, res) => {
      const { getWorldById } = res.socket.db
      res.json(JSON.stringify(await getWorldById(getRandom())))
    })
    .get('/fortunes', async (req, res) => {
      const { getAllFortunes } = res.socket.db
      res.html(template.call([extra, ...(await getAllFortunes())].sort(sortByMessage)))
    })
    .get('/query', async (req, res) => {
      const { getWorldsById } = res.socket.db
      const worlds = await getWorldsById(spray(getCount(req.query), getRandom))
      res.json(JSON.stringify(worlds))
    }, { qs: true })
    .get('/json', (req, res) => res.json(JSON.stringify(json)))
    .get('/plaintext', (req, res) => res.text(message))
    .connect(sock => (sock.db = pool[sock.fd % poolSize]))

  // listen on the given port and address
  server.listen(port, address)
}

main().catch(err => just.error(err.stack))
