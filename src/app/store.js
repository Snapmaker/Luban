import { createStore, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
/* eslint-disable import/no-cycle */
import reducer from './flux';
import { appbarMenuMiddleware } from './lib/redux-middleware';

const reduxStore = createStore(reducer, applyMiddleware(thunk, appbarMenuMiddleware));

export const dispatch = reduxStore.dispatch;
export default reduxStore;
