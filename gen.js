const postgres = require('pg.js')
const { generateSource } = postgres
const config = require('techempower.config.js')

function compile (query) {
  const fields = []
  for (let i = 0; i < query.fields.length; i++) {
    fields.push({ name: query.fieldNames[i], oid: query.fields[i].oid })
  }
  const src = generateSource(query.name, fields)
  //const fn = just.vm.compile(src, `${query.name}.js`, [], [])
  return `module.exports.${query.name} = function ${query.name} () {\n${src}\n}`
}

const modules = []
for (const name of Object.keys(config.queries)) {
  modules.push(compile(config.queries[name]))
}

just.fs.writeFile('compiled.js', ArrayBuffer.fromString(modules.join('\n')))
