#!/bin/bash
CONCURRENCY=256
echo warming up
wrk -c $CONCURRENCY -t 2 -d 30 http://127.0.0.1:8080/plaintext
echo plaintext
wrk -c $CONCURRENCY -t 2 -d 30 http://127.0.0.1:8080/plaintext
echo json
wrk -c $CONCURRENCY -t 2 -d 30 http://127.0.0.1:8080/json
echo single
wrk -c $CONCURRENCY -t 2 -d 30 http://127.0.0.1:8080/db
echo multi
wrk -c $CONCURRENCY -t 2 -d 30 http://127.0.0.1:8080/query?q=10
echo update
wrk -c $CONCURRENCY -t 2 -d 30 http://127.0.0.1:8080/update?q=10
echo fortunes
wrk -c $CONCURRENCY -t 2 -d 30 http://127.0.0.1:8080/fortunes
