import { combineReducers } from 'redux';
import machine from './machine';
import laser from './laser';
import cnc from './cnc';
import workspace from './workspace';

export default combineReducers({
    workspace,
    machine,
    laser,
    cnc
});
