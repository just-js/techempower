// postgres imports
const postgres = require('@pg')

const { BinaryInt, VarChar, fieldTypes } = postgres.constants
const { INT4OID, VARCHAROID } = fieldTypes

// database connection details
const db = {
  hostname: 'tfb-database',
  user: 'benchmarkdbuser',
  pass: 'benchmarkdbpass',
  database: 'hello_world',
  bufferSize: 256 * 1024
}

// web server configuration
const httpd = {
  address: '0.0.0.0',
  port: 8080,
  name: 'j'
}

const templates = {
  fortunes: 'fortunes.html',
  settings: { rawStrings: false, compile: true }
}

const queries = {
  update: {
    name: 'A'
  },
  worlds: {
    name: 'B',
    sql: 'select id, randomNumber from World where id = $1',
    fields: [
      { format: BinaryInt, name: 'id', oid: INT4OID },
      { format: BinaryInt, name: 'randomnumber', oid: INT4OID }
    ],
    params: 1,
    formats: [BinaryInt]
  },
  fortunes: {
    name: 'C',
    sql: 'select * from Fortune',
    fields: [
      { format: BinaryInt, name: 'id', oid: INT4OID },
      { format: VarChar, name: 'message', oid: VARCHAROID, htmlEscape: true }
    ]
  }
}

const maxRandom = 10000
const maxQuery = 50
const stackTraces = false

module.exports = {
  db, httpd, maxRandom, maxQuery, templates, queries, stackTraces
}
