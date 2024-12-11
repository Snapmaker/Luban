import * as Formidable from 'formidable';
import { Server, createServer } from 'http';
import SocketServer from '../../../lib/SocketManager';
import logger from '../../../lib/logger';
import DataStorage from '../../../DataStorage';
import { connectionManager } from '../ConnectionManager';
import SocketEvent from '../../../../app/communication/socket-events';
import { HEAD_PRINTING } from '../../../constants';

const log = logger('service:machine:adapter:Octo');

const maxMemory = 64 * 1024 * 1024; // 64MB
interface ConnectionCloseOptions {
    port?: number;
}
class Octo {
    private socket: SocketServer | null = null;
    private server: Server | null = null;
    private ip: string = '0.0.0.0';
    private port: number = 5000;

    public onStart = () => {
        this.socket = new SocketServer();
        // create single listener Server
        if (this.server !== null) {
            return;
        }
        this.server = createServer();
        this.server.on('request', (req, res) => {
            try {
                const start = new Date().getTime();
                res.on('finish', () => {
                    const end = new Date().getTime();
                    const duration = end - start;
                    log.info(`Request ${req.method} ${req.url} completed in ${duration}ms`);
                });
                if (req.url === '/') {
                    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end('Welcome to Snapmker OctoPrint proxy service');
                } else if (req.url === '/api/version') {
                    const respVersion = JSON.stringify({
                        api: '0.1', server: '1.2.3', text: 'OctoPrint 1.2.3/Dummy',
                    });
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(respVersion);
                } else if (req.url === '/api/files/local') {
                    const form = new Formidable.IncomingForm({
                        maxFileSize: maxMemory, uploadDir: DataStorage.tmpDir // set temporary file path
                    });
                    form.parse(req, async (err, fields, files) => {
                        log.info(fields);
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
                        if (fields.print === 'true') {
                            result = await this.printGcodeFile(file, fields?.headType ?? HEAD_PRINTING);
                        } else {
                            result = await this.sendGcodeFile(this.socket, file);
                        }
                        if (result.err) {
                            log.info(`Upload error: ${payload.Name} [${payload.Size}]`);
                            res.writeHead(406, { 'Content-Type': 'text/plain' });
                            res.end(`upload file ${payload.Name} ${result.err},reason: ${result.text}`);
                        } else {
                            // Simulating upload to printer
                            log.info(`Upload finished: ${payload.Name} [${payload.Size}]`);
                            res.writeHead(200, { 'Content-Type': 'application/json' });

                            res.end(JSON.stringify({ done: true, status: 'ok' }));
                        }
                    });
                } else {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Not Found');
                }
            } catch (err) {
                log.error(`Unexpected server error: ${err.message}`);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
            }
        });
        // Note: start listener
        this.server.listen(this.port, this.ip, () => {
            log.info(`octo adapter server start, address: ${this.ip}:${this.port}`);
        });
    }

    public onStop = () => {
        if (this.server === null) {
            return;
        }
        this.server && this.server.removeAllListeners();
        this.server.close(() => {
            log.info('octo adapter server closed');
        });
        this.server = null;
    }

    public onResetPort = (socket: SocketServer, options: ConnectionCloseOptions, callback) => {
        this.port = options.port;
        console.log('line:112 this.port::: ', this.port);

        if (this.server) {
            this.onStop();
            this.onStart();
        }
        callback(`Octo port is : ${this.port}`);
    }

    private sendGcodeFile = async (socket: SocketServer, file): Promise<any> => {
        return new Promise((resolve) => {
            const event = SocketEvent.UploadFile;
            socket.once(event, (data) => {
                resolve(data);
            });
            connectionManager.uploadFile(socket, {
                filePath: file.newFilename,
                targetFilename: file.originalFilename,
            });
        });
    }

    private printGcodeFile = async (file, headType): Promise<never> => {
        return new Promise((resolve) => {
            this.socket.once(SocketEvent.StartGCode, (data) => {
                resolve(data);
            });
            connectionManager.startGcode(this.socket, {
                headType: headType,
                eventName: SocketEvent.StartGCode,
                uploadName: file.newFilename,
                renderName: file.originalFilename,
            });
        });
    }
}


const octo = new Octo();

export {
    octo
};
