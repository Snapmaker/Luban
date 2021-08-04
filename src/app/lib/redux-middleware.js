import UniApi from './uni-api';
import {
    ACTION_UPDATE_STATE as APPBAR_MENU_ACTION_UPDATE_STATE
} from '../flux/appbar-menu';

let timer;

export function appbarMenuMiddleware() {
    return function (next) {
        return function (action) {
            switch (action.type) {
                case APPBAR_MENU_ACTION_UPDATE_STATE: // notify main process to update menu
                    if (action.state.menu) {
                        UniApi.Event.emit('appbar-menu:update-electron-menu', action);
                    }
                    break;
                default:
                    // update appbar-menu after current action processed
                    clearTimeout(timer);
                    timer = setTimeout(() => {
                        UniApi.Event.emit('appbar-menu:should-update');
                    }, 10);
                    break;
            }
            return next(action);
        };
    };
}
