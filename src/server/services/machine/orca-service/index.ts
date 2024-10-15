import * as os from 'os';
import * as Formidable from 'formidable';
import { connectionManager } from '../ConnectionManager';
import SocketServer from '../../../lib/SocketManager';
import SocketEvent from '../../../../app/communication/socket-events';
import DataStorage from '../../../DataStorage';
import logger from '../../../lib/logger';

const log = logger('lib:ConnectionManager');

const http = require('http');

const io = new SocketServer();

let server;
let SERVER_PORT = 65526;
let SERVER_IP = getLocalIPAddress();
const printer = { ID: 'not Connection ', IP: SERVER_IP + ':' + SERVER_PORT, Sacp: true };
const maxMemory = 64 * 1024 * 1024; // 64MB

function getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '0.0.0.0'; // Fallback to localhost if no external IP is found
}

function checkConnection() {
    log.info(`connectionManager: ${connectionManager}`);

    if (connectionManager?.machineInstance?.id) {
        printer.ID = connectionManager.machineInstance.id;
        printer.IP = connectionManager.machineInstance.ip;
        return true;
    }
    return false;
}

async function sendGcodeFile(file): Promise<any> {
    if (!checkConnection()) {
        return {
            err: true,
            text: 'No machine connection',
        }
    }

    return new Promise((resolve, reject) => {
        connectionManager.uploadFile(io, {
            filePath: file.newFilename,
            targetFilename: file.originalFilename,
        });

        const event = SocketEvent.UploadFile;
        io.on(event, (data) => {
            resolve(data);
        });
    });
}

async function printGcodeFile(file): Promise<any> {
    if (!checkConnection()) {
        return {
            err: true,
            text: 'No machine connection',
        }
    }

    return new Promise((resolve, reject) => {
        const event = SocketEvent.StartGCode;
        connectionManager.startGcode(io, {
            eventName: event,
            uploadName: file.newFilename,
            renderName: file.originalFilename,
        });

        io.on(event, (data) => {
            resolve({
                err: null,
                text: 'success',
            });
        });
    });
}

function openServer() {
    // 防止重复开启
    closeServer();

    server = http.createServer();
    server.on('request', (req, res) => {
        const start = new Date().getTime();
        const connectionStatus = `machine connection: ${checkConnection()}`;
        log.info(`connectionStatus: ${connectionStatus}`);

        res.on('finish', () => {
            const end = new Date().getTime();;
            const duration = end - start;
            log.info(`Request ${req.method} ${req.url} completed in ${duration}ms`);
        });

        if (req.url === '/') {
            const protocol = printer.Sacp ? 'SACP' : 'HTTP';
            const resp = `Welcome to Snapmker OctoPrint proxy service
                printer id: ${printer.ID}
                printer ip: ${printer.IP}
                machineConnection: ${checkConnection()}
                protocol: ${protocol}`;
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(resp);
        } else if (req.url === '/api/version') {
            const respVersion = JSON.stringify({ api: '0.1', server: '1.2.3', text: 'OctoPrint 1.2.3/Dummy', machineConnection: checkConnection() });
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(respVersion);
        } else if (req.url === '/api/files/local') {
            if(!checkConnection()) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(JSON.stringify({ text: 'No machine connection' }));
                return;
            }
            const form = new Formidable.IncomingForm({ 
                maxFileSize: maxMemory,
                uploadDir: DataStorage.tmpDir // set temporary file path
             });
            form.parse(req, async (err, fields, files) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end(JSON.stringify({ err, text: 'Internal Server Error' }));
                    return;
                }

                const file: Formidable.File = files.file;
                log.info(`file: ${file}`);
                if (!file) {
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    res.end(JSON.stringify({ text: 'No file uploaded' }));
                    return;
                }
                const payload = { Name: file.originalFilename, Size: file.size };
                let result;
                if (fields.print === 'true') result = await printGcodeFile(file);
                else result = await sendGcodeFile(file);
                log.info(`upload file result: ${result}`);

                if (result.err) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end(JSON.stringify({ done: result.text || 'Error uploading to printer', payload }));
                    log.info(`upload file error: ${result.text}`)
                } else {
                    // Simulating upload to printer
                    log.info(`Upload finished: ${payload.Name} [${payload.Size}]`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ done: true, payload }));
                }
            });
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    });

    // return server;
    return new Promise((resolve, reject) => {
        server.listen(SERVER_PORT, SERVER_IP, () => {
            resolve(`orca server start, address: http://${SERVER_IP}:${SERVER_PORT}`)
        });
        server.on("error", (err) => {
            if (err.code === 'EADDRINUSE') {
                reject(`port:${SERVER_PORT} occupied, please replace the port`)
            }
        });

    });

}

function closeServer() {
    server && server.removeAllListeners();
    server && server.close(() => {
        log.info(`server closed`);
    });
}

export {
    openServer,
    closeServer
}