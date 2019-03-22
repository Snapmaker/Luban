import SerialConnection from '../src/app/lib/SerialConnection';

const port = '/dev/tty.wchusbserial14110';
let serialport = new SerialConnection({
    port: port,
    writeFilter: (data) => {
        return data;
    }
});

console.log(serialport.ident);
serialport.open((err) => {
    console.log(err);
});
