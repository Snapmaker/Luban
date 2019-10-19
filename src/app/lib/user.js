import api from '../api';
import { machineStore } from '../store/local-storage';

let authenticated = false;

module.exports = {
    signin: ({ token }) => new Promise((resolve) => {
        api.signin({ token })
            .then((res) => {
                const { enabled = false, token: newToken = '', name = '' } = { ...res.body };
                machineStore.set('session.enabled', enabled);
                machineStore.set('session.token', newToken);
                machineStore.set('session.name', name);

                authenticated = true;
                resolve({ authenticated: true });
            })
            .catch(() => {
                // Keep session.name if a login failure occurred
                machineStore.unset('session.token');
                authenticated = false;
                resolve({ authenticated: false });
            });
    }),
    signout: () => new Promise((resolve) => {
        machineStore.unset('session.token');
        authenticated = false;
        resolve();
    }),
    authenticated: () => {
        return authenticated;
    }
};
