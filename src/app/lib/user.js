import api from '../api';
import store from '../store';

let authenticated = false;

module.exports = {
    signin: ({ token }) => new Promise((resolve) => {
        api.signin({ token })
            .then((res) => {
                const { enabled = false, token: newToken = '', name = '' } = { ...res.body };
                store.set('session.enabled', enabled);
                store.set('session.token', newToken);
                store.set('session.name', name);

                authenticated = true;
                resolve({ authenticated: true });
            })
            .catch(() => {
                // Keep session.name if a login failure occurred
                store.unset('session.token');
                authenticated = false;
                resolve({ authenticated: false });
            });
    }),
    signout: () => new Promise((resolve) => {
        store.unset('session.token');
        authenticated = false;
        resolve();
    }),
    authenticated: () => {
        return authenticated;
    }
};
