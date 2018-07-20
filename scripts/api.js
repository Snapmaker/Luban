#!/bin/env node
const request = require('superagent');

// const API_VERSION = 'http://localhost:8009/version/snapjs';
const API_VERSION = 'https://api.snapmaker.com/version/snapjs';

const data = {
    token: '34a470eb86aa44b4b5d4f7c74f4a5172',
    snapjs: '2.4.2',
    snapmaker_firmware: '2.4'
};
console.log('Updating version', data);
request
    .post(API_VERSION, data)
    .end((err, res) => {
        if (err) {
            console.error('Update version failed.');
            return;
        }
        const { msg } = res.body;
        if (msg === 'ok') {
            console.error('Update version succeed.');
        }
    });

setTimeout(() => {
    request
        .get(API_VERSION)
        .end((err, res) => {
            console.log(res.body);
        });
}, 10000);
