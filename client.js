var Client = require('ssh2').Client;

var conn = new Client();
conn.on('ready', function() {
  console.log('Client :: ready');
  conn.sftp(function(err, sftp) {
    if (err) throw err;
    sftp.readdir('.', {full: true}, function(err, list) {
      if (err) throw err;
      console.dir(list);
      conn.end();
    });
  });
}).connect({
  host: '127.0.0.1',
  port: 8022,
  username: 'root',
  password: 'password'
});
