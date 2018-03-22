const constants = require('constants');
const fs = require('fs');

const ssh2 = require('ssh2');
const OPEN_MODE = ssh2.SFTP_OPEN_MODE;
const STATUS_CODE = ssh2.SFTP_STATUS_CODE;

/*
Commands:
Start server: node ./testserver.js
Upload file: sftp -P8022 root@127.0.0.1 <<< $(echo "put /path/to/file")

Create host.key: ssh-keygen -t rsa -f ./host.key

Urls:
SFTP server example: https://github.com/mscdex/ssh2/blob/master/examples/sftp-server-download-only.js
More info: https://github.com/mscdex/ssh2#password-and-public-key-authentication-and-non-interactive-exec-command-execution
SFTPStream: https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md

SFTP protocol: https://www.ssh.com/a/draft-ietf-secsh-filexfer-02.txt
*/

const dirfiles = [{
    filename: '/',
    longname: 'drwxr-xr-x    2 root     root         4096 Mar 22 10:10 /',
    attrs: {}
}];

const handleClient = client => {
    console.log('client connected');

    client.on('authentication', ctx => {
        if (ctx.method === 'password' && ctx.username === 'root' && ctx.password === 'password') {
            ctx.accept();
        } else {
            ctx.reject(['password']);
        }
    });

    client.on('ready', ctx => {
        console.log('Client authenticated!!');

        client.on('session', (accept, reject) => {
            console.log('Starting session');
            const session = accept();

            handleSession(session);
        });
    });
}

const handleSession = session => {
    session.on('pwd', (accept, reject) => {
        console.log('pwd?');
    });

    session.on('dir', (accept, reject) => {
        console.log('dir??');
    });

    session.on('sftp', (accept, reject) => {
        const openFiles = {};
        let handleCount = 0;

        const sftpStream = accept();

        ['OPEN', 'READ', 'WRITE', 'CLOSE', 'REALPATH', 'FSTAT', 'FSETSTAT', 'STAT', 'LSTAT', 'OPENDIR', 'READDIR', 'REMOVE', 'RMDIR', 'READLINK', 'SETSTAT', 'MKDIR', 'RENAME', 'SYMLINK'].map(ev => {
            sftpStream.on(ev, (reqid, filename, flags, attrs) => {
                console.log(ev, reqid, filename, flags, attrs);

                if (ev === 'REALPATH') {
                    console.log('REALPATH filename', filename);
                    if (filename !== '.' && filename !== '/.' && filename !== '/') {
                        let basename = filename.replace(/^\//, '');
                        dirfiles.push({
                            filename: basename,
                            longname: '-rwxr-xr-x    2 root     root         4096 Mar 22 10:10 /' + basename,
                            attrs: {}
                        });
                    }
                    
                    console.log(dirfiles);
                    sftpStream.name(reqid, dirfiles);
                } else if (ev === 'OPEN') {
                    if (!(flags & OPEN_MODE.WRITE)) {
                        console.log('Error: only writing is allowed');
                    }

                    const handle = new Buffer(4);
                    openFiles[handleCount] = {
                        read: false,
                        filename: filename,
                        wstream: fs.createWriteStream('./upload' + filename)
                    };
                    handle.writeUInt32BE(handleCount++, 0, true);
                    sftpStream.handle(reqid, handle);
                    console.log(`Opening file ${filename} for writing`);
                } else if (ev === 'OPENDIR') {
                    const handle = new Buffer(4);
                    openFiles[handleCount] = {
                        read: false
                    };
                    handle.writeUInt32BE(handleCount++, 0, true);
                    sftpStream.handle(reqid, handle);
                } else if (ev === 'READDIR') {
                    const handleNum = filename.readUInt32BE(0, true);
                    const handle = openFiles[handleNum];
                    
                    sftpStream.name(reqid, dirfiles);
                    sftpStream.status(reqid, STATUS_CODE.EOF);
                } else if (ev === 'WRITE') {
                    const handleNum = filename.readUInt32BE(0, true);
                    const handle = openFiles[handleNum];
                    handle.wstream.write(attrs);
                    sftpStream.status(reqid, STATUS_CODE.OK);
                } else if (ev === 'CLOSE') {
                    const handleNum = filename.readUInt32BE(0, true);
                    const handle = openFiles[handleNum];
                    if (handle && handle.wstream) {
                        handle.wstream.end();
                    }
                    sftpStream.status(reqid, STATUS_CODE.OK);
                }
            });
        });
    });
}

const server = new ssh2.Server({
    hostKeys: [fs.readFileSync('host.key')]
}, handleClient);

server.listen(8022, '127.0.0.1', () => {
    console.log('Listening on port ' + server.address().port);
});
