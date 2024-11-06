import * as Formidable from 'formidable';
import { Server, createServer } from 'http';
import SocketServer from '../../../lib/SocketManager';
import logger from '../../../lib/logger';
import DataStorage from '../../../DataStorage';
import { connectionManager } from '../ConnectionManager';
import SocketEvent from '../../../../app/communication/socket-events';

const log = logger('service:machine:adapter:Klipper');

const maxMemory = 64 * 1024 * 1024; // 64MB

class Klipper {
    private socket: SocketServer | null = null;
    private server: Server | null = null;
    private ip: string = '0.0.0.0';
    private port: number = 65526;

    public onStart = async (socket: SocketServer) => {
        this.socket = socket;
        // create single listener Server
        if (this.server !== null) {
            return;
        }
        this.server = createServer();
        this.server.on('request', (req, res) => {
            const start = new Date().getTime();

            res.on('finish', () => {
                const end = new Date().getTime();
                const duration = end - start;
                log.info(`Request ${req.method} ${req.url} completed in ${duration}ms`);
            });

            if (req.url === '/') {
                res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Welcome to Snapmker OctoPrint proxy service');
            } else if (req.url === '/api/version') {
                const respVersion = JSON.stringify({
                    api: '0.1', server: '1.2.3', text: 'OctoPrint 1.2.3/Dummy',
                });
                res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'} );
                res.end(respVersion);
            } else if (req.url === '/api/files/local') {
                const form = new Formidable.IncomingForm({
                    maxFileSize: maxMemory, uploadDir: DataStorage.tmpDir // set temporary file path
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
                    if (fields.print === 'true') result = await this.printGcodeFile(file);
                    else result = await this.sendGcodeFile(file);
                    log.info(`upload file result: ${result}`);

                    if (result.err) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end(JSON.stringify({ done: result.text || 'Error uploading to printer', payload }));
                        log.info(`upload file error: ${result.text}`);
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
        // Note: start listener
        this.server.listen(this.port, this.ip, () => {
            log.info(`octo klipper adapter server start, address: ${this.ip}:${this.port}`);
        });
    }

    public onStop = () => {
        if (this.server == null) {
            return;
        }
        this.server && this.server.removeAllListeners();
        this.server.close(() => {
            log.info('octo klipper adapter server closed');
        });
        this.server = null;
    }

    private sendGcodeFile = async (file): Promise<any> => {

        return new Promise((resolve) => {
            connectionManager.uploadFile(this.socket, {
                filePath: file.newFilename,
                targetFilename: file.originalFilename,
            });

            const event = SocketEvent.UploadFile;
            this.socket.on(event, (data) => {
                resolve(data);
            });
        });
    }

    private printGcodeFile = async (file): Promise<any> => {
        return new Promise((resolve) => {
            const event = SocketEvent.StartGCode;
            connectionManager.startGcode(this.socket, {
                eventName: event,
                uploadName: file.newFilename,
                renderName: file.originalFilename,
            });
            this.socket.on(event, () => {
                resolve({
                    err: null,
                    text: 'success',
                });
            });
        });
    }
}


const klipper = new Klipper();

export {
    klipper
};
