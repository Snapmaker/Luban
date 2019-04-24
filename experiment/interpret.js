// ./node_modules/babel-cli/bin/babel-node.js ./test/serialConnection.js
import interpret from '../src/server/lib/interpret';

let jogSpeed = 0;
let workSpeed = 0;
let headStatus = null;
let headPower = 0;

const line = 'M5 S200';

interpret(line, (cmd, params) => {
    if (cmd === 'G0' && params.F) {
        jogSpeed = params.F;
    }
    if (cmd === 'G1' && params.F) {
        workSpeed = params.F;
    }
    if (cmd === 'M3') {
        headStatus = 'on';
        if (params.S) {
            headPower = params.S;
        }
    }
    if (cmd === 'M5') {
        headStatus = 'off';
    }
});

console.log(`${jogSpeed} - ${workSpeed} - ${headStatus} - ${headPower}`);
