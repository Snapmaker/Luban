import events from 'events';
import Mousetrap from 'mousetrap';
import log from './log';
import { preventDefault } from './dom-events';

const AXIS_X = 'x';
const AXIS_Y = 'y';
const AXIS_Z = 'z';
const AXIS_A = 'a';
const FORWARD = 1;
const BACKWARD = -1;
const OVERSHOOT_FACTOR = 10; // 10x
const UNDERSHOOT_FACTOR = 0.1; // 0.1x

const commandKeys = [
    {
        keys: ['backspace', 'del'],
        cmd: 'DELETE',
        payload: {
        },
        preventDefault: true
    },
    {
        keys: ['esc'],
        cmd: 'ESC',
        payload: {
        },
        preventDefault: true
    },
    {
        keys: ['mod+a'],
        cmd: 'SELECTALL',
        payload: {
        },
        preventDefault: true
    },
    {
        keys: ['mod+c'],
        cmd: 'COPY',
        payload: {
        },
        preventDefault: true
    },
    {
        keys: ['mod+v'],
        cmd: 'PASTE',
        payload: {
        },
        preventDefault: true
    },
    {
        keys: ['mod+z'],
        cmd: 'UNDO',
        payload: {
        },
        preventDefault: true
    },
    {
        keys: ['mod', 'd'].join('+'),
        cmd: 'DUPLICATE',
        payload: {
        },
        preventDefault: true
    },
    { // Feed Hold
        keys: '!',
        cmd: 'CONTROLLER_COMMAND',
        payload: {
            command: 'feedhold'
        },
        preventDefault: true
    },
    { // Cycle Start
        keys: '~',
        cmd: 'CONTROLLER_COMMAND',
        payload: {
            command: 'cyclestart'
        },
        preventDefault: true
    },
    { // Homing
        keys: ['ctrl', 'alt', 'command', 'h'].join('+'),
        cmd: 'CONTROLLER_COMMAND',
        payload: {
            command: 'homing'
        },
        preventDefault: true
    },
    { // Unlock
        keys: ['ctrl', 'alt', 'command', 'u'].join('+'),
        cmd: 'CONTROLLER_COMMAND',
        payload: {
            command: 'unlock'
        },
        preventDefault: true
    },
    { // Reset
        keys: ['ctrl', 'alt', 'command', 'r'].join('+'),
        cmd: 'CONTROLLER_COMMAND',
        payload: {
            command: 'reset'
        },
        preventDefault: true
    },
    { // Select Jog Distance
        keys: ['ctrl', 'alt', 'command', '='].join('+'),
        cmd: 'JOG_LEVER_SWITCH',
        payload: {
        },
        preventDefault: true
    },
    { // Select Jog Distance (Alias)
        keys: ['ctrl', 'alt', 'command', 'd'].join('+'),
        cmd: 'JOG_LEVER_SWITCH',
        payload: {
        },
        preventDefault: true
    },
    { // Jog Forward
        keys: ['ctrl', 'alt', 'command', ']'].join('+'),
        cmd: 'JOG',
        payload: {
            axis: null,
            direction: FORWARD,
            factor: 1
        },
        preventDefault: true
    },
    { // Jog Forward (Alias)
        keys: ['ctrl', 'alt', 'command', 'f'].join('+'),
        cmd: 'JOG',
        payload: {
            axis: null,
            direction: FORWARD,
            factor: 1
        },
        preventDefault: true
    },
    { // Jog Backward
        keys: ['ctrl', 'alt', 'command', '['].join('+'),
        cmd: 'JOG',
        payload: {
            axis: null,
            direction: BACKWARD,
            factor: 1
        },
        preventDefault: true
    },
    { // Jog Backward (Alias)
        keys: ['ctrl', 'alt', 'command', 'b'].join('+'),
        cmd: 'JOG',
        payload: {
            axis: null,
            direction: BACKWARD,
            factor: 1
        },
        preventDefault: true
    },
    { // Jog X+
        keys: 'right',
        cmd: 'Arrow',
        payload: {
            axis: AXIS_X,
            direction: FORWARD,
            factor: 1
        },
        preventDefault: false
    },
    { // Jog X+ (undershoot)
        keys: 'alt+right',
        cmd: 'JOG',
        payload: {
            axis: AXIS_X,
            direction: FORWARD,
            factor: UNDERSHOOT_FACTOR
        },
        preventDefault: false
    },
    { // Jog X+ (overshoot)
        keys: 'shift+right',
        cmd: 'JOG',
        payload: {
            axis: AXIS_X,
            direction: FORWARD,
            factor: OVERSHOOT_FACTOR
        },
        preventDefault: false
    },
    { // Jog X-
        keys: 'left',
        cmd: 'Arrow',
        payload: {
            axis: AXIS_X,
            direction: BACKWARD,
            factor: 1
        },
        preventDefault: false
    },
    { // Jog X- (undershoot)
        keys: 'alt+left',
        cmd: 'JOG',
        payload: {
            axis: AXIS_X,
            direction: BACKWARD,
            factor: UNDERSHOOT_FACTOR
        },
        preventDefault: false
    },
    { // Jog X- (overshoot)
        keys: 'shift+left',
        cmd: 'JOG',
        payload: {
            axis: AXIS_X,
            direction: BACKWARD,
            factor: OVERSHOOT_FACTOR
        },
        preventDefault: false
    },
    { // Jog Y+
        keys: 'up',
        cmd: 'Arrow',
        payload: {
            axis: AXIS_Y,
            direction: FORWARD,
            factor: 1
        },
        preventDefault: true
    },
    { // Jog Y+ (undershoot)
        keys: 'alt+up',
        cmd: 'JOG',
        payload: {
            axis: AXIS_Y,
            direction: FORWARD,
            factor: UNDERSHOOT_FACTOR
        },
        preventDefault: false
    },
    { // Jog Y+ (overshoot)
        keys: 'shift+up',
        cmd: 'JOG',
        payload: {
            axis: AXIS_Y,
            direction: FORWARD,
            factor: OVERSHOOT_FACTOR
        },
        preventDefault: false
    },
    { // Jog Y-
        keys: 'down',
        cmd: 'Arrow',
        payload: {
            axis: AXIS_Y,
            direction: BACKWARD,
            factor: 1
        },
        preventDefault: true
    },
    { // Jog Y- (undershoot)
        keys: 'alt+down',
        cmd: 'JOG',
        payload: {
            axis: AXIS_Y,
            direction: BACKWARD,
            factor: UNDERSHOOT_FACTOR
        },
        preventDefault: false
    },
    { // Jog Y- (overshoot)
        keys: 'shift+down',
        cmd: 'JOG',
        payload: {
            axis: AXIS_Y,
            direction: BACKWARD,
            factor: OVERSHOOT_FACTOR
        },
        preventDefault: false
    },
    { // Jog Z+
        keys: 'pageup',
        cmd: 'JOG',
        payload: {
            axis: AXIS_Z,
            direction: FORWARD,
            factor: 1
        },
        preventDefault: false
    },
    { // Jog Z+ (undershoot)
        keys: 'alt+pageup',
        cmd: 'JOG',
        payload: {
            axis: AXIS_Z,
            direction: FORWARD,
            factor: UNDERSHOOT_FACTOR
        },
        preventDefault: false
    },
    { // Jog Z+ (overshoot)
        keys: 'shift+pageup',
        cmd: 'JOG',
        payload: {
            axis: AXIS_Z,
            direction: FORWARD,
            factor: OVERSHOOT_FACTOR
        },
        preventDefault: false
    },
    { // Jog Z-
        keys: 'pagedown',
        cmd: 'JOG',
        payload: {
            axis: AXIS_Z,
            direction: BACKWARD,
            factor: 1
        },
        preventDefault: false
    },
    { // Jog Z- (undershoot)
        keys: 'alt+pagedown',
        cmd: 'JOG',
        payload: {
            axis: AXIS_Z,
            direction: BACKWARD,
            factor: UNDERSHOOT_FACTOR
        },
        preventDefault: false
    },
    { // Jog Z- (overshoot)
        keys: 'shift+pagedown',
        cmd: 'JOG',
        payload: {
            axis: AXIS_Z,
            direction: BACKWARD,
            factor: OVERSHOOT_FACTOR
        },
        preventDefault: false
    },
    { // Jog A+
        keys: ']',
        cmd: 'JOG',
        payload: {
            axis: AXIS_A,
            direction: FORWARD,
            factor: 1
        },
        preventDefault: false
    },
    { // Jog A+ (undershoot)
        keys: 'alt+]',
        cmd: 'JOG',
        payload: {
            axis: AXIS_A,
            direction: FORWARD,
            factor: UNDERSHOOT_FACTOR
        },
        preventDefault: false
    },
    { // Jog A+ (overshoot)
        keys: 'shift+]',
        cmd: 'JOG',
        payload: {
            axis: AXIS_A,
            direction: FORWARD,
            factor: OVERSHOOT_FACTOR
        },
        preventDefault: false
    },
    { // Jog A-
        keys: '[',
        cmd: 'JOG',
        payload: {
            axis: AXIS_A,
            direction: BACKWARD,
            factor: 1
        },
        preventDefault: false
    },
    { // Jog A- (undershoot)
        keys: 'alt+[',
        cmd: 'JOG',
        payload: {
            axis: AXIS_A,
            direction: BACKWARD,
            factor: UNDERSHOOT_FACTOR
        },
        preventDefault: false
    },
    { // Jog A- (overshoot)
        keys: 'shift+[',
        cmd: 'JOG',
        payload: {
            axis: AXIS_A,
            direction: BACKWARD,
            factor: OVERSHOOT_FACTOR
        },
        preventDefault: false
    }
];

class Combokeys extends events.EventEmitter {
    state = {
        didBindEvents: false
    };

    list = [];

    constructor(options = {}) {
        super();

        if (options.autoBind) {
            this.bind();
        }
    }

    bind() {
        if (this.state.didBindEvents) {
            return;
        }
        commandKeys.forEach((o) => {
            const { keys, cmd, payload = {} } = o;
            const callback = (event) => {
                log.debug(`combokeys: keys=${keys} cmd=${cmd} payload=${JSON.stringify(payload)}`);
                if (o.preventDefault) {
                    preventDefault(event);
                }
                this.emit(cmd, event, payload);
            };
            Mousetrap.bind(keys, callback);
            this.list.push({ keys: keys, callback: callback });
        });
        this.state.didBindEvents = true;
    }

    unbind() {
        if (!this.state.didBindEvents) {
            return;
        }
        this.list.forEach((o) => {
            const { keys, callback } = o;
            Mousetrap.unbind(keys, callback);
        });
        this.state.didBindEvents = false;
    }

    reset() {
        Mousetrap.reset();
        this.state.didBindEvents = false;
    }
}

const combokeys = new Combokeys({ autoBind: true });

export default combokeys;
