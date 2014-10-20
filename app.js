var express = require('express');
var pg = require('pg');

var dbuser = "nodeapp";
var dbpass = "password";
var dbhost = "localhost";
var dbport = "5432";
var dbname = "nodeapp";
var conString = "postgres://" + dbuser + ":" + dbpass + "@" + dbhost + ":" + dbport + "/" + dbname;

var app = express();
app.get('/', function (req, res) {
  pg.connect(conString, function(err, client, done) {
    if (err) {
      return console.error('error fetching client from pool', err);
    }
    client.query('SELECT $1::int AS number', ['1'], function(err, result) {
      done(); // release the db client back to the pool
      if(err) {
        return console.error('error running query', err);
      }
      res.send('Hello World!' + result.rows[0].number);
    });
  });
})

var server = app.listen(3000, function () {

  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port)

});
