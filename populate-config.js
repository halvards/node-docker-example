#!/usr/bin/env node

var path = require("path");
var redis = require("redis");

if (process.argv.length != 2 || !process.argv[0] || !parseInt(process.argv[1])) {
  var scriptName = __filename.slice(__filename.lastIndexOf(path.sep) + 1);
  console.log("Usage: " + scriptName + " redis_host redis_port");
  process.exit(1);
}

var redisHost = process.argv[0];
var redisPort = process.argv[1];
var options = {}; // see https://github.com/mranney/node_redis/blob/master/README.md

var client = redis.createClient(redisPort, redisHost, options);
client.on("error", function(err) {
  console.error(err, err.stack);
});

client.set("app-dbuser", "nodeappuser", redis.print);
client.set("app-dbpass", "password", redis.print);
client.set("app-dbhost", "localhost", redis.print);
client.set("app-dbport", "5432", redis.print);
client.set("app-dbname", "nodeappdb", redis.print);
