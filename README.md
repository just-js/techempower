# [Just-JS](https://github.com/just-js) Benchmarking Test

This test benchmarks the [Just-JS](https://github.com/just-js) framework. Just-JS is an in progress javascript framework for x86_64 linux.

Author: Andrew Johnston <billy@billywhizz.io>

### Test Type Implementation Source Code

* [JSON] techempower.js
* [PLAINTEXT] techempower.js
* [DB] techempower.js
* [QUERY] techempower.js
* [CACHED QUERY] techempower.js
* [UPDATE] techempower.js
* [FORTUNES] techempower.js

## Test URLs
### JSON

http://localhost:8080/json

### PLAINTEXT

http://localhost:8080/plaintext

### DB

http://localhost:8080/db

### QUERY

http://localhost:8080/query?q=

### UPDATE

http://localhost:8080/update?q=

### FORTUNES

http://localhost:8080/fortunes

### CACHED QUERY

http://localhost:8080/cached-world?q=

## Todo
- fix spawn.js socketpairs for stdin/stdout/stderr
- module support
- just a dockerfile with a FROM - build from just-js/techempower using github?
- check all return codes
- tests
- fuzzing
- cpu/memory/io usage stats

## Optimizations
- test SIMD for html escape
- optimize http parser
- SetAlignedPointer for ArrayBuffers
- test syscall overhead
- io_uring
- StringBuffers
