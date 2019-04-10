import { combineReducers } from 'redux';
import machine from './machine';
import printing from './printing';
import laser from './laser';
import cnc from './cnc';
import cncLaserShared from './cncLaserShared';
import workspace from './workspace';
import keyboardShortcut from './keyboardShortcut';
import text from './text';

export default combineReducers({
    workspace,
    machine,
    printing,
    laser,
    cnc,
    cncLaserShared,
    keyboardShortcut,
    text
});
