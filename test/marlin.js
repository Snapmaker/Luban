import { test } from 'tap';
import Marlin from '../src/server/controllers/Marlin/Marlin';

test('MarlinLineParserResultStart', (t) => {
    const marlin = new Marlin();
    marlin.on('start', ({ raw }) => {
        t.equal(raw, 'start');
        t.end();
    });

    const line = 'start';
    marlin.parse(line);
});

test('MarlinLineParserResultPosition', (t) => {
    const marlin = new Marlin();
    marlin.on('pos', ({ raw, pos }) => {
        t.equal(raw, 'X:1.529 Y:-5.440 Z:0.00 E:0.00 Count X:0 Y:0 Z:0');
        t.same(pos, {
            x: '1.529',
            y: '-5.440',
            z: '0.00',
            e: '0.00'
        });
        t.end();
    });

    const line = 'X:1.529 Y:-5.440 Z:0.00 E:0.00 Count X:0 Y:0 Z:0';
    marlin.parse(line);
});

test('MarlinLineParserResultOk', (t) => {
    const marlin = new Marlin();
    marlin.on('ok', ({ raw }) => {
        t.equal(raw, 'ok');
        t.end();
    });

    const line = 'ok';
    marlin.parse(line);
});

test('MarlinLineParserResultEcho', (t) => {
    const marlin = new Marlin();
    marlin.on('echo', ({ raw, message }) => {
        t.equal(raw, 'echo:message');
        t.equal(message, 'message');
        t.end();
    });

    const line = 'echo:message';
    marlin.parse(line);
});

test('MarlinLineParserResultError', (t) => {
    const marlin = new Marlin();
    marlin.on('error', ({ raw, message }) => {
        t.equal(raw, 'Error:Printer halted. kill() called!');
        t.equal(message, 'Printer halted. kill() called!');
        t.end();
    });

    const line = 'Error:Printer halted. kill() called!';
    marlin.parse(line);
});
