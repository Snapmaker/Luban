#!/usr/bin/env node

const yargsParser = require('yargs-parser');
const path = require('path');
const fs = require('fs');

const argv = yargsParser(process.argv);

const config = {
    auth: {
        token: argv.SentryToken,
        dsn: argv.SentryDsn
    },
    defaults: {
        org: 'snapmaker',
        project: 'luban'
    },
    tagName: argv.tagName
};

const target = path.resolve(__dirname, '../.sentry.config.json');
const content = JSON.stringify(config, null, 4);
fs.writeFileSync(target, `${content}\n`, 'utf8');
