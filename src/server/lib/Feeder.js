/* eslint no-continue: 0 */
import events from 'events';

class Feeder extends events.EventEmitter {
    state = {
        queue: [],
        pending: false,
        changed: false
    };

    dataFilter = null;

    // @param {object} [options] The options object.
    // @param {function} [options.dataFilter] A function to be used to handle the data.
    //      The function accepts two arguments: The data to be sent to the controller, and the context.
    constructor(options) {
        super();

        if (typeof options.dataFilter === 'function') {
            this.dataFilter = options.dataFilter;
        }

        this.on('change', () => {
            this.state.changed = true;
        });
    }

    toJSON() {
        return {
            queue: this.state.queue.length,
            pending: this.state.pending,
            changed: this.state.changed
        };
    }

    feed(data = [], context = {}) {
        data = [].concat(data);
        if (data.length > 0) {
            this.state.queue = this.state.queue.concat(data.map(command => {
                return { command: command, context: context };
            }));
            this.emit('change');
        }
    }

    clear() {
        this.state.queue = [];
        this.state.pending = false;
        this.emit('change');
    }

    size() {
        return this.state.queue.length;
    }

    next() {
        if (this.state.queue.length === 0) {
            this.state.pending = false;
            return false;
        }

        while (this.state.queue.length > 0) {
            const item = this.state.queue.shift();
            const { context } = item;
            let { command } = item;

            if (this.dataFilter) {
                command = this.dataFilter(command, context) || '';
                if (!command) {
                    continue;
                }
            }

            this.state.pending = true;
            this.emit('data', command, context);
            this.emit('change');
            break;
        }

        return this.state.pending;
    }

    isPending() {
        return this.state.pending;
    }

    // Returns true if any state have changes
    peek() {
        const changed = this.state.changed;
        this.state.changed = false;
        return changed;
    }
}

export default Feeder;
