const postgres = require('pg.js')

const { connect, constants } = postgres
const { BinaryInt, VarChar, fieldTypes } = constants
const { INT4OID, VARCHAROID } = fieldTypes

async function main () {
  const db = {
    hostname: 'tfb-database',
    user: 'benchmarkdbuser',
    pass: 'benchmarkdbpass',
    database: 'hello_world'
  }
  const sock = await connect(db)
  const query = {
    name: 'fortunes',
    sql: 'select * from Fortune',
    fields: [
      { format: BinaryInt, name: 'id', oid: INT4OID },
      { format: VarChar, name: 'message', oid: VARCHAROID }
    ]
  }
  const fortunes = sock.createQuery(query)
  await fortunes.setup().generate().compile().create()
  const runs = 10000
  async function next () {
    const start = Date.now()
    for (let i = 0; i < runs; i++) await fortunes.run()
    const elapsed = Date.now() - start
    just.print(`${elapsed} ${Math.floor((runs * 100) / (elapsed / 1000)) / 100}`)
    just.setTimeout(next, 1000)
  }
  let clients = parseInt(just.args[2] || '1', 10)
  while (clients--) next()
}

main().catch(err => just.error(err.message))
