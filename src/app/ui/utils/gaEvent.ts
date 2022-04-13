import i18next from 'i18next';
import ReactGA from 'react-ga4';
import { machineStore } from '../../store/local-storage';

export function logPageView({ pathname, isRotate }: { pathname: string, isRotate: boolean }) {
    if (pathname) {
        const axis = isRotate ? '-4axis' : '-3axis';

        switch (pathname) {
            case '/':
                ReactGA.send({ hitType: 'pageview', page: '/#/home' });
                break;
            case '/printing':
            case '/workspace':
                ReactGA.send({ hitType: 'pageview', page: `/#${pathname}` });
                break;
            case '/laser':
            case '/cnc':
                ReactGA.send({ hitType: 'pageview', page: `/#${pathname}${axis}` });
                break;
            default:
        }
    }
}


function emitToGa(messageType: string, category: string, data: Record<string, string>) {
    data.userId = machineStore.get('userId');
    data.language = i18next.language;
    data.toolHead = machineStore.get('machine.toolHead.printingToolhead');
    data.machine = machineStore.get('machine.series');

    ReactGA.gtag('event', 'sendMessage', {
        messageType,
        category,
        ...data
    });
}

export function successfulUse(projectId: string, projectType: string) {
    return emitToGa('successful_use', 'user', {
        projectId,
        projectType
    });
}

export function printingSaveProject(projectId: string) {
    return emitToGa('3dp_save_project', 'save_project', {
        projectId,
        printing_module: 'printing_module'
    });
}


export function initialize(userId: string) {
    ReactGA.initialize('G-CZ95MGND3N');
    ReactGA.gtag('set', 'user_properties', {
        'crm_id': userId
    });
    ReactGA.gtag('config', 'G-CZ95MGND3N', {
        custom_map: {
            dimension0: 'messageType',
            metric0: 'num'
        },
        debug_mode: true
    });
}

export default {
    logPageView,
    successfulUse,
    printingSaveProject
};
