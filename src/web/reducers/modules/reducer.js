import { combineReducers } from 'redux';
import machine from './machine';
import laser from './laser';
import cnc from './cnc';

export default combineReducers({
    machine,
    laser,
    cnc
});
