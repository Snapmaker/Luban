// "exp": "babel-node experiment/test_marlin_parser.js",
import { MarlinLineParser } from '../src/server/controllers/Marlin/Marlin';


function test(line) {
    const parser = new MarlinLineParser();
    const res = parser.parse(line);

    console.log('--');
    console.log(`parse: ${line}`);
    console.log(`parse type: ${res.type ? res.type.name : null}`);
    console.log(`parse result: ${JSON.stringify(res)}`);
}


test('Snapmaker-Base-1.2');
test('Firmware Version: Snapmaker-Base-2.2');
test('Firmware Version: Snapmaker-Base-2.4-alpha2');
test('Firmware Version: Snapmaker-Base-2.4-beta');

test('3DP'); // wrong
test('Tool Head: 3DP');
test('Tool Head: LASER');
test('Tool Head: LASER 350');
test('Tool Head: CNC');

