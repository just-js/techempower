const statSql = `
SELECT 'session' AS name, row_to_json(t) AS data
FROM (SELECT
   (SELECT count(*) FROM pg_stat_activity WHERE datname = (SELECT datname FROM pg_database WHERE oid = 16385)) AS "total",
   (SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND datname = (SELECT datname FROM pg_database WHERE oid = 16385))  AS "active",
   (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle' AND datname = (SELECT datname FROM pg_database WHERE oid = 16385))  AS "idle"
) t
UNION ALL
SELECT 'tps' AS name, row_to_json(t) AS data
FROM (SELECT
   (SELECT sum(xact_commit) + sum(xact_rollback) FROM pg_stat_database WHERE datname = (SELECT datname FROM pg_database WHERE oid = 16385)) AS "tx",
   (SELECT sum(xact_commit) FROM pg_stat_database WHERE datname = (SELECT datname FROM pg_database WHERE oid = 16385)) AS "commit",
   (SELECT sum(xact_rollback) FROM pg_stat_database WHERE datname = (SELECT datname FROM pg_database WHERE oid = 16385)) AS "rollback"
) t
UNION ALL
SELECT 'ti' AS name, row_to_json(t) AS data
FROM (SELECT
   (SELECT sum(tup_inserted) FROM pg_stat_database WHERE datname = (SELECT datname FROM pg_database WHERE oid = 16385)) AS "insert",
   (SELECT sum(tup_updated) FROM pg_stat_database WHERE datname = (SELECT datname FROM pg_database WHERE oid = 16385)) AS "update",
   (SELECT sum(tup_deleted) FROM pg_stat_database WHERE datname = (SELECT datname FROM pg_database WHERE oid = 16385)) AS "delete"
) t
UNION ALL
SELECT 'to' AS name, row_to_json(t) AS data
FROM (SELECT
   (SELECT sum(tup_fetched) FROM pg_stat_database WHERE datname = (SELECT datname FROM pg_database WHERE oid = 16385)) AS "fetch",
   (SELECT sum(tup_returned) FROM pg_stat_database WHERE datname = (SELECT datname FROM pg_database WHERE oid = 16385)) AS "return"
) t
UNION ALL
SELECT 'bio' AS name, row_to_json(t) AS data
FROM (SELECT
   (SELECT sum(blks_read) FROM pg_stat_database WHERE datname = (SELECT datname FROM pg_database WHERE oid = 16385)) AS "read",
   (SELECT sum(blks_hit) FROM pg_stat_database WHERE datname = (SELECT datname FROM pg_database WHERE oid = 16385)) AS "hit"
) t
`

function getStatSql (tables) {
  return tables.map(name => {
    return `
SELECT '${name}' AS name, row_to_json(t) AS data
FROM (SELECT
  (SELECT COALESCE(SUM(calls), 0) FROM pg_stat_statements WHERE query ~* '[[:<:]]${name}[[:>:]]') AS "call",
  (SELECT COALESCE(SUM(rows), 0) FROM pg_stat_statements WHERE query ~* '[[:<:]]${name}[[:>:]]' AND query ~* 'select') AS "select",
  (SELECT COALESCE(SUM(rows), 0) FROM pg_stat_statements WHERE query ~* '[[:<:]]${name}[[:>:]]' AND query ~* 'update') AS "update"
) t`
  }).join('\nUNION ALL\n')
}

const util = require('util.js')
const postgres = require('pg.js')

const { stringify } = util
const { connect, constants } = postgres
const { BinaryInt, VarChar, fieldTypes } = constants
const { INT4OID, VARCHAROID } = fieldTypes

function parse (row) {
  return { name: row.name, stats: JSON.parse(row.data) }
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
    name: 'stats1',
    sql: statSql,
    fields: [
      { format: VarChar, name: 'name', oid: VARCHAROID },
      { format: VarChar, name: 'data', oid: VARCHAROID }
    ]
  }
  const stats = await sock.createQuery(query).setup().generate().compile().create()
  const rows = (await stats.run()).map(parse)
  just.print(stringify(rows))

  const query2 = {
    name: 'stats2',
    sql: getStatSql(['world', 'fortunes']),
    fields: [
      { format: VarChar, name: 'name', oid: VARCHAROID },
      { format: VarChar, name: 'data', oid: VARCHAROID }
    ]
  }
  const stats2 = await sock.createQuery(query2).setup().generate().compile().create()
  const rows2 = (await stats2.run()).map(parse)
  just.print(stringify(rows2))

  sock.close()
}

main().catch(err => just.error(err.message))
