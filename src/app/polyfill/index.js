/* eslint-disable */

// ES5
require('es5-shim/es5-shim');
require('es5-shim/es5-sham');

// Babel polyfill
// https://babeljs.io/docs/en/babel-polyfill
// require('babel-polyfill');
import 'core-js/stable';
import 'regenerator-runtime/runtime';

// console (IE9)
require('./console');

require('imports-loader?self=>window!js-polyfills/web'); // deps: Symbol
