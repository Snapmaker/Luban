import events from 'events';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import _ from 'lodash';
import chalk from 'chalk';
import parseJSON from 'parse-json';
import logger from '../../lib/logger';

const log = logger('service:configstore');

const defaultState = { // default state

};
const allMacros = [
    {
        name: 'M502&M500 Restore Factory Defaults',
        content: 'M502\nM500'
    },
    {
        name: 'M200 S0 Controller Status',
        content: 'M2000 S0'
    },
    {
        name: 'M200 S0 Controller Status',
        content: 'M2000 S0'
    },
    {
        name: 'M1999 Booting Log',
        content: 'M1999'
    },
    {
        name: 'M1005 Firmware Info',
        content: 'M1005'
    },
    {
        name: 'M420 V Bed Leveling Data',
        content: 'M420 V'
    },
    {
        name: 'M119 Limit&Proximity Switch Status',
        content: 'M119'
    },
    {
        name: 'M503 Controller Settings',
        content: 'M503'
    },
    {
        name: 'M1006 Toolhead Status',
        content: 'M1006'
    },
    {
        name: 'M1007 Origin Info',
        content: 'M1007'
    }
];
const defaultMacros = allMacros.map((item) => {
    item.id = uuid();
    item.mtime = new Date().getTime();
    item.repeat = 1;
    item.isDefault = true;
    return item;
});

class ConfigStore extends events.EventEmitter {
    file = '';

    config = {};

    watcher = null;

    // @param {string} file The path to a filename.
    // @return {object} The config object.
    load(file) {
        this.file = file;
        this.reload();
        this.initMacros();
        // useless !
        this.emit('load', this.config); // emit load event

        if (this.watcher) {
            // Stop watching for changes
            this.watcher.close();
            this.watcher = null;
        }

        try {
            if (!fs.existsSync(this.file)) {
                const content = JSON.stringify({ macros: defaultMacros });
                fs.writeFileSync(this.file, content, 'utf8');
            }

            this.watcher = fs.watch(this.file, (eventType, filename) => {
                log.debug(`fs.watch(eventType='${eventType}', filename='${filename}')`);

                if (eventType === 'change') {
                    log.debug(`"${filename}" has been changed`);
                    const ok = this.reload();
                    ok && this.emit('change', this.config); // it is ok to emit change event
                }
            });
        } catch (err) {
            log.error(err);
            this.emit('error', err); // emit error event

            this.config = { macros: defaultMacros };
            const content = JSON.stringify(this.config);
            fs.writeFileSync(this.file, content, 'utf8');
        }
        return this.config;
    }

    reload() {
        try {
            if (fs.existsSync(this.file)) {
                const content = fs.readFileSync(this.file, 'utf8');
                this.config = parseJSON(content);
            }
        } catch (err) {
            err.fileName = this.file;
            log.error(`Unable to load data from ${chalk.yellow(JSON.stringify(this.file))}: err=${err}`);
            // this.emit('error', err); // emit error event

            this.config = { macros: defaultMacros };
            const content = JSON.stringify(this.config);
            fs.writeFileSync(this.file, content, 'utf8');

            return false;
        }

        if (!_.isPlainObject(this.config)) {
            log.error(`"${this.file}" does not contain valid JSON`);
            this.config = {};
        }

        this.config.state = {
            ...defaultState,
            ...this.config.state
        };

        return true;
    }

    initMacros() {
        if (this.config) {
            this.config.macros = _.uniqBy(Array.isArray(this.config.macros) ? defaultMacros.concat(this.config.macros) : defaultMacros, 'content');
        }
    }

    sync() {
        try {
            const content = JSON.stringify(this.config, null, 4);
            fs.writeFileSync(this.file, content, 'utf8');
        } catch (err) {
            log.error(`Unable to write data to "${this.file}"`);
            this.emit('error', err); // emit error event
            return false;
        }

        return true;
    }

    has(key) {
        return _.has(this.config, key);
    }

    get(key, defaultValue) {
        if (!this.config) {
            this.reload();
        }

        return (key !== undefined)
            ? _.get(this.config, key, defaultValue)
            : this.config;
    }

    set(key, value, options) {
        const { silent = false } = { ...options };

        if (key === undefined) {
            return;
        }

        const ok = this.reload(); // reload before making changes
        _.set(this.config, key, value);
        ok && !silent && this.sync(); // it is ok to write
    }

    unset(key) {
        if (key === undefined) {
            return;
        }

        const ok = this.reload(); // reload before making changes
        _.unset(this.config, key);
        ok && this.sync(); // it is ok to write
    }
}

const configstore = new ConfigStore();

export default configstore;
