const postgres = require('../libs/pg/pg.js')
const config = require('tfb.config.js')
const { stringify } = require('../examples/pgnative/util.js')

const fortunes = {
  name: '',
  sql: 'select * from Fortune'
}

const worlds = {
  name: 'b',
  sql: 'select * from World order by id asc limit 10'
}

async function main () {
  async function execute (sql, name = '') {
    let query = cache[name]
    if (!query || query.sql !== sql) {
      just.print(`compiling ${sql} for ${name}`)
      const compiled = await sock.compile({ name, sql })
      query = { compiled, sql }
      cache[name] = query
    }
    const { compiled } = query
    const rows = await compiled.runSingle()
    const { fields, portal } = compiled.query
    const count = sock.parser.state.rows
    return { rows, fields, portal, sql: compiled.query.sql, count }
  }

  const cache = {}
  let sock
  try {
    sock = (await postgres.connect(config.db))[0]

    const getAllFortunes = await sock.compile(fortunes, 1)
    const getWorlds = await sock.compile(worlds, 1)

    let result

    result = await getAllFortunes.runSingle()
    just.print(stringify(result))
    result = await getWorlds.runSingle()
    just.print(stringify(result))

    result = await execute('BEGIN')
    just.print(stringify(result))

    result = await execute('select * from fortune')
    just.print(stringify(result))

    result = await execute('COMMIT')
    just.print(stringify(result))

    result = await execute('BEGIN')
    just.print(stringify(result))

    result = await execute('select message from fortune where id = 7')
    just.print(stringify(result))

    result = await execute('COMMIT')
    just.print(stringify(result))

    result = await execute('INSERT INTO world (id, randomnumber) VALUES (1, 1000)')
    just.print(stringify(result))

    result = await execute('INSERT INTO foo (id, randomnumber) VALUES (1, 1000)')
    just.print(stringify(result))

    result = await execute('CREATE TABLE foo')
    just.print(stringify(result))

    result = await execute('select * from world limit 5')
    just.print(stringify(result))
  } catch (err) {
    just.error(stringify(err))
  } finally {
    sock.close()
  }
}

main().catch(err => just.error(err.stack))
