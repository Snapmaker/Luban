import { combineReducers } from 'redux';
import laser from './laser';
import cnc from './cnc';

export default combineReducers({
    laser,
    cnc
});
