#!/bin/bash
#echo warming up
wrk -c 64 -t 2 -d 30 http://127.0.0.1:8080/plaintext
#echo plaintext
wrk -c 64 -t 2 -d 30 http://127.0.0.1:8080/plaintext
#echo json
wrk -c 64 -t 2 -d 30 http://127.0.0.1:8080/json
echo single
wrk -c 64 -t 2 -d 30 http://127.0.0.1:8080/db
echo multi
wrk -c 64 -t 2 -d 30 http://127.0.0.1:8080/query?q=10
echo update
wrk -c 64 -t 2 -d 30 http://127.0.0.1:8080/update?q=10
echo fortunes
wrk -c 64 -t 2 -d 30 http://127.0.0.1:8080/fortunes
