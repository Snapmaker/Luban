import api from '../api';
import { machineStore } from '../store/local-storage';

let authenticated = false;

const signin = ({ token }) => new Promise((resolve) => {
    api.signin({ token })
        .then((res) => {
            const { enabled = false, token: newToken = '', name = '', sceneJson = '', userId } = { ...res.body };
            machineStore.set('session.enabled', enabled);
            machineStore.set('session.token', newToken);
            machineStore.set('session.name', name);
            machineStore.set('scene', sceneJson);
            machineStore.set('userId', userId);

            authenticated = true;
            resolve({ authenticated: true });
        })
        .catch(() => {
            // Keep session.name if a login failure occurred
            machineStore.unset('session.token');
            authenticated = false;
            resolve({ authenticated: false });
        });
});

export default {
    signin,
    signout: () => new Promise((resolve) => {
        machineStore.unset('session.token');
        authenticated = false;
        resolve();
    }),
    authenticated: () => {
        return authenticated;
    }
};
