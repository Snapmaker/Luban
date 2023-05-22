/* eslint-disable import/no-cycle */
import { combineReducers } from 'redux';

import appGlobal from './app-global';
import appbarMenu from './appbar-menu';
import cnc from './cnc';
import editor from './editor';
import laser from './laser';
import machine from './machine';
import printing from './printing';
import project from './project';
import text from './text';
import widget from './widget';
import workspace from './workspace';

export default combineReducers({
    appGlobal,
    workspace,
    machine,
    printing,
    laser,
    cnc,
    // models,
    text,
    widget,
    editor,
    project,
    appbarMenu
});
