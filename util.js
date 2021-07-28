const ar = {}

for (let i = 1; i <= 100; i++) {
  ar[i] = (new Array(i)).fill(1)
}

const spray = (count, fn) => ar[count].map(fn)

module.exports = { spray }

//const x = Array.from(Array(5), (e, i) => e.name)
