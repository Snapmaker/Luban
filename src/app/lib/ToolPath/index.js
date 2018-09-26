
const COMMANDS = {
    COMMENT: ';',
    // Linear Move
    RAPID_MOVE: 'G0',
    MOVE: 'G1',
    SPINDLE_ON_CW: 'M3',
    SPINDLE_OFF: 'M5'
};

function filterEmpty(e) {
    return !!e;
}

class Command {
    constructor(cmd, ...args) {
        this.cmd = cmd;
        this.args = args.filter(filterEmpty) || [];

        this.parseArgs();
    }

    parseArgs() {
        // parse args and save as key/value pairs
    }

    push(arg) {
        this.args.push(arg);
    }

    toGcode() {
        return this.cmd + ' ' + this.args.join(' ');
    }
}

class ToolPath {
    commands = [];
    state = {
        rapidMoveRate: 0,
        moveRate: 0
    };

    setMoveRate(f) {
        if (!!f && f !== this.state.moveRate) {
            this.state.moveRate = f;
            return `F${f}`;
        }
        return '';
    }

    setRapidMoveRate(f) {
        if (!!f && f !== this.state.rapidMoveRate) {
            this.state.rapidMoveRate = f;
            return `F${f}`;
        }
        return '';
    }

    comment(text) {
        this.commands.push(new Command(COMMANDS.COMMENT, text));
    }

    move0XY(x, y, f) {
        const moveRate = this.setMoveRate(f);
        this.commands.push(new Command(COMMANDS.RAPID_MOVE, `X${x}`, `Y${y}`, moveRate));
    }

    move0Z(z, f) {
        const moveRate = this.setMoveRate(f);
        this.commands.push(new Command(COMMANDS.RAPID_MOVE, `Z${z}`, moveRate));
    }

    // TODO: what about E<pos>?
    move1XY(x, y, f) {
        const moveRate = this.setRapidMoveRate(f);
        this.commands.push(new Command(COMMANDS.MOVE, `X${x}`, `Y${y}`, moveRate));
    }

    move1Z(z, f) {
        const moveRate = this.setRapidMoveRate(f);
        this.commands.push(new Command(COMMANDS.MOVE, `Z${z}`, moveRate));
    }

    spindleOn() {
        this.commands.push(new Command(COMMANDS.SPINDLE_ON_CW));
    }

    spindleOff() {
        this.commands.push(new Command(COMMANDS.SPINDLE_OFF));
    }

    toGcode() {
        return this.commands.reduce((gcode, command) => {
            return gcode + command.toGcode() + '\n';
        }, '');
    }
}

export {
    Command
};

export default ToolPath;
