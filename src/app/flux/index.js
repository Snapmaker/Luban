import { combineReducers } from 'redux';
import machine from './machine';
import printing from './printing';
import laser from './laser';
import cnc from './cnc';
import editor from './editor';
import workspace from './workspace';
import widget from './widget';
import developTools from './develop-tools';
// import models from './models';
import text from './text';
import project from './project';
import appbarMenu from './appbar-menu';

export default combineReducers({
    workspace,
    machine,
    printing,
    laser,
    cnc,
    // models,
    text,
    widget,
    developTools,
    editor,
    project,
    appbarMenu
});
