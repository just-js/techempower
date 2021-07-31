const postgres = require('pg.js')

const { BinaryInt, VarChar, fieldTypes } = postgres.constants
const { INT4OID, VARCHAROID } = fieldTypes

const db = {
  hostname: 'tfb-database',
  user: 'benchmarkdbuser',
  pass: 'benchmarkdbpass',
  database: 'hello_world'
}

const server = {
  address: '127.0.0.1',
  port: 8080,
  name: 'j'
}

const templates = {
  fortunes: 'fortunes.html',
  settings: { rawStrings: false, compile: true }
}

const queries = {
  update: {
    name: 'u1'
  },
  worlds: {
    name: 's1',
    sql: 'select id, randomNumber from World where id = $1',
    fields: [
      { format: BinaryInt, name: 'id', oid: INT4OID },
      { format: BinaryInt, name: 'randomnumber', oid: INT4OID }
    ],
    params: 1,
    formats: [BinaryInt]
  },
  fortunes: {
    name: 's2',
    sql: 'select * from Fortune',
    fields: [
      { format: BinaryInt, name: 'id', oid: INT4OID },
      { format: VarChar, name: 'message', oid: VARCHAROID }
    ]
  }
}

const maxRandom = 10000
const maxQuery = 50
const stackTraces = false

module.exports = {
  db, server, maxRandom, maxQuery, templates, queries, stackTraces
}
