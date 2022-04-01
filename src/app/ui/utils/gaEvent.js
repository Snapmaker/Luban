import ReactGA from 'react-ga4';
import { machineStore } from '../../store/local-storage';

export function logPageView({ pathname, isRotate }) {
    if (pathname) {
        const axis = isRotate ? '-4axis' : '-3axis';
        console.log('pageview', pathname, axis, machineStore.get('userId'));
        switch (pathname) {
            case '/':
                ReactGA.send({ hitType: 'pageview', page: '/#/home' });
                ReactGA.event({
                    category: 'user',
                    action: '/#/home',
                    transport: 'xhr', // optional, beacon/xhr/image
                    dimension: {
                        user_id: machineStore.get('userId')
                    },
                    metric: {
                        user_id: machineStore.get('userId'),
                        path: '/#/home'
                    }
                });
                break;
            case '/printing':
            case '/workspace':
                ReactGA.send({ hitType: 'pageview', page: `/#${pathname}` });
                ReactGA.event({
                    category: 'user',
                    action: `/#${pathname}`,
                    transport: 'xhr', // optional, beacon/xhr/image
                    dimension: {
                        user_id: machineStore.get('userId')
                    },
                    metric: {
                        user_id: machineStore.get('userId'),
                        path: `/#${pathname}`
                    }
                });
                break;
            case '/laser':
            case '/cnc':
                ReactGA.send({ hitType: 'pageview', page: `/#${pathname}${axis}` });
                ReactGA.event({
                    category: 'user',
                    action: `/#${pathname}${axis}`,
                    transport: 'xhr', // optional, beacon/xhr/image
                    dimension: {
                        user_id: machineStore.get('userId')
                    },
                    metric: {
                        user_id: machineStore.get('userId'),
                        path: `/#${pathname}${axis}`
                    }
                });
                break;
            default:
        }
    }
}

export default {
    logPageView
};
