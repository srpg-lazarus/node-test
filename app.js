var port = 3000;

var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io').listen(http);

var redis_options = {
  host: '127.0.0.1',
  port: 6379,
};
var redis = require('redis').createClient(redis_options);
var redisSessionPrefix = 'ci_session:'; // ほぼ固定 CIのsess_match_ipを有効にすると変わる

var mysql = require('mysql');
var connection = mysql.createConnection({
  host : 'localhost',
  user : '', // TODO: MySQL UserName
  database : 'portal_main'
});
connection.connect();

var cookieParser = require('cookie-parser');
var unserialize = require('php-unserialize');

app.use(cookieParser());
var sessionCookieName = 'php_session'; // CIのsess_cookie_nameに合わせる


app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.get('/cookie', function(req, res) {
  var cookies = (function(str) {
    var result = {};
    str.split(/;\s+/).forEach(function(e){
      var parts = e.split(/=/,2);
      result[parts[0]]=parts[1]||'';
    });
    return result;
  })(req.headers.cookie);
  var sessionCookieName = 'php_session';
  var sessionId = cookies[sessionCookieName];

  redis.get(redisSessionPrefix + sessionId,function(err, reply) {
    console.err(sessionId);
    console.log('[' + reply + ']');
    var session = unserialize.unserializeSession(reply);
    var result = '<div>' + 'session_id : ' + sessionId + '</div>';
    result += '<div>' + 'session : ' + JSON.stringify(session) + '</div>';
    res.send(result);
  });
});

var userHash = {};

io.sockets.on('connection', function(socket) {

  function getSession(cb) {
    console.log(socket.request.headers.cookie);
    var cookies = (function(str) {
    var result = {};
    str.split(/;\s+/).forEach(function(e){
      var parts = e.split(/=/,2);
      result[parts[0]]=parts[1]||'';
    });
      return result;
    })(socket.request.headers.cookie);
    console.log(cookies);
    var sessionId = cookies[sessionCookieName];

    redis.get(redisSessionPrefix + sessionId,function(err, reply) {
      cb(unserialize.unserializeSession(reply))
    });
  };

  socket.on("connected", function() {
    getSession(function(session) {
      var name = session['user_name'];
      var msg = name + "が入室しました。"
      io.sockets.emit("publish", {value: msg});
      userHash[socket.id] = name;
      socket.emit("named", {name: name});

      // deck
      var sql = "SELECT * FROM deck WHERE user_id = ?";
      var params = [session['user_id']];
      sql = mysql.format(sql, params); 
      connection.query(sql, function(err, rows, fields) {
        rows.forEach(function(v) {
          var msg = "deck:" + v.value;
          socket.emit("publish", {value: msg});
        });
      });
    });
  });

  socket.on("publish", function (data) {
    io.sockets.emit("publish", {value:data.value});
  });

  socket.on("disconnect", function (){
    if(userHash[socket.id]) {
      var msg = userHash[socket.id] + "が退出しました。";
      delete userHash[socket.id];
      io.sockets.emit("publish", {value: msg});
    }
  });

});

http.listen(port, function() {
  console.log('listening on *:' + port);
});
