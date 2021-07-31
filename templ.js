const util = require('util.js')
const postgres = require('pg.js')
const html = require('@html')

// https://www.postgresql.org/docs/12/parallel-query.html
// https://www.postgresql.org/docs/12/protocol.html

const { stringify } = util
const { connect, constants } = postgres
const { BinaryInt, VarChar, fieldTypes } = constants
const { INT4OID, VARCHAROID } = fieldTypes
const { Tokenizer, Parser } = html

function bench (template, rows, runs = 40000000) {
  for (let i = 0; i < 10; i++) {
    const start = Date.now()
    for (let i = 0; i < runs; i++) template.call(rows)
    const elapsed = Date.now() - start
    just.print(`${elapsed} ${Math.floor((runs * 100) / (elapsed / 1000)) / 100}`)
  }
}

function createTemplate (fileName, args = ['rows'], plugins = {}) {
  const tokenizer = new Tokenizer()
  const parser = new Parser('', false)
  tokenizer.tokenize(just.fs.readFileBytes(fileName))
  parser.plugins = plugins
  parser.all(tokenizer.tokens)
  return just.vm.compile(parser.source.join('\n'), `${fileName}.js`, args, [])
}

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
  const fortunes = await sock.createQuery(query).setup().generate().compile().create()
  const rows = await fortunes.run()
  const template = createTemplate('fortunes.html')
  // just.print(stringify(rows))
  // just.print(template.toString())
  // just.print(template.call(rows))
  sock.close()
  bench(template, rows, 6000000)
}

main().catch(err => just.error(err.message))
