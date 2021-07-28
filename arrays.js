const { spray } = require('util.js')
const getRandom = () => Math.floor(Math.random() * 10000)

const f1 = i => spray(i, getRandom)
const f2 = i => [...Array(i)].map(getRandom)
const f3 = i => Array.from(Array(i), getRandom)

function bench (fn, v = 5, runs = 1000000) {
  const start = Date.now()
  for (let i = 0; i < runs; i++) {
    fn(v)
  }
  const elapsed = Date.now() - start
  just.print(`${fn.name} (${v}) ${r}: ${elapsed}`)
}

just.print(JSON.stringify(f1(5)))
just.print(JSON.stringify(f2(5)))
just.print(JSON.stringify(f3(5)))

let v = 5
let r = 5000000
while (1) {
  bench(f1, v, r)
  bench(f2, v, r)
  bench(f3, v, r)
  v += 5
  r = Math.floor(r * 0.9)
}
