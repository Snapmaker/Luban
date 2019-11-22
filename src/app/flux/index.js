import { combineReducers } from 'redux';
import machine from './machine';
import printing from './printing';
import laser from './laser';
import cnc from './cnc';
import cncLaserShared from './cncLaserShared';
import workspace from './workspace';
import keyboardShortcut from './keyboardShortcut';
import widget from './widget';
import developTools from './develop-tools';
// import models from './models';
import text from './text';

export default combineReducers({
    workspace,
    machine,
    printing,
    laser,
    cnc,
    cncLaserShared,
    keyboardShortcut,
    // models,
    text,
    widget,
    developTools
});
