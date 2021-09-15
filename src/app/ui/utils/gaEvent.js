import ReactGA from 'react-ga';

export function logPageView({ pathname, isRotate }) {
    if (pathname) {
        const axis = isRotate ? '-4axis' : '-3axis';
        switch (pathname) {
            case '/':
                // ReactGA.set({ page: path });
                ReactGA.pageview('/#/home');
                break;
            case '/3dp':
            case '/workspace':
                ReactGA.pageview(`/#${pathname}`);
                break;
            case '/laser':
            case '/cnc':
                ReactGA.pageview(`/#${pathname}${axis}`);
                break;
            default:
        }
    }
}

export function logEvent({ category, action, label }) {
    if (category && action) {
        ReactGA.event({
            category,
            action,
            label
        });
    }
}

export default {
    logPageView,
    logEvent
};
