import i18next from 'i18next';
import ReactGA from 'react-ga4';
import { v4 as uuid } from 'uuid';
import isElectron from 'is-electron';
import { machineStore } from '../store/local-storage';
import pkg from '../../package.json';

type THeadType = 'printing' | 'laser' | 'cnc'

type Transformation = {
    move: 'input' | 'center' | 'axis' | 'XY' | 'arrange',
    scale: 'input_%' | 'axis' | 'to_fit' | 'reset',
    roate: 'input' | 'axis' | 'analyze_in' | 'analyze_out' | 'face' | 'auto' | 'reset',
    mirror: 'button'
    support: 'auto' | 'edit_in' | 'edit_done' | 'clear'
}

type ToolName = 'save' | 'undo' | 'redo' | 'align' | 'group' | 'ungroup' | 'split'
    // laser /cnc
    | 'job_setup' | 'top' | 'bottom'
    // laser_special
    | 'camera_capture_add_backgroup' | 'camera_capture_remove_backgroup'


const pageview = (pathname) => {
    if (process.env.NODE_ENV !== 'production') {
        return;
    }
    ReactGA.send({
        hitType: 'pageview',
        page: pathname,
        title: `${pkg.name} ${pkg.version}`
    });
};
export function logPageView({ pathname, isRotate = false }: { pathname: string, isRotate?: boolean }) {
    const axis = isRotate ? '-4axis' : '-3axis';

    if (pathname) {
        switch (pathname) {
            case '/':
                pageview('/#/home');
                break;
            case '/printing':
            case '/workspace':
                pageview(`/#${pathname}`);
                break;
            case '/laser':
            case '/cnc':
                pageview(`/#${pathname}${axis}`);
                break;
            default:
        }
    }
}

const getToolHead = (headType: THeadType) => {
    const toolHead = machineStore.get('machine.toolHead');
    return toolHead[`${headType}Toolhead`] as string;
};

const getProjectType = (headType: THeadType, isRotate?: boolean) => {
    if (headType === 'cnc' || headType === 'laser') {
        headType += isRotate ? '_4axis' : '_3axis';
    }
    return headType;
};

const sendMessage = (messageType: string, category: string, data: Record<string, string | number> = {}) => {
    if (process.env.NODE_ENV !== 'production') {
        return;
    }
    data.userId = machineStore.get('userId');
    data.userLanguage = i18next.language;
    data.machine = machineStore.get('machine.series');
    data.projectId = machineStore.get('projectId');
    data.recordTimetamp = new Date().getTime();


    if (data.headType) {
        data.toolHead = getToolHead(data.headType as THeadType);
        delete data.headType;
    }
    ReactGA.gtag('event', 'sendMessage', {
        messageType,
        category,
        ...data
    });
};

export const lubanVisit = () => {
    return sendMessage('luban_visit', 'user', {
        message: isElectron() ? 'electron' : 'web'
    });
};

export const logLubanQuit = () => {
    machineStore.set('projectId', '');
    return sendMessage('luban_quit', 'user');
};

export const logErrorToGA = (errorInfo) => {
    return sendMessage('error_boundaries', 'system', {
        message: errorInfo?.componentStack
    });
};

export const logModuleVisit = (headType: THeadType, isRotate?: boolean) => {
    machineStore.set('projectId', uuid());

    const projectType = getProjectType(headType, isRotate);
    return sendMessage(`${projectType}_visit`, 'user');
};

export const logToolBarOperation = (headType: THeadType, toolName: ToolName) => {
    return sendMessage(`${headType}_${toolName}`, `${headType}Tool`, {
        headType
    });
};

export const logTransformOperation = <Key extends keyof Transformation>(headType: THeadType, transformMode: Key, triggerType: Transformation[Key]) => {
    return sendMessage(`${headType}_${transformMode}_${triggerType}`, `${headType}Transformation`, {
        headType
    });
};

export const logObjectListOperation = (headType: THeadType, type: 'pack' | 'expand', objectCount: number = -1) => {
    return sendMessage(`${headType}_object_list_${type}`, 'object_list', {
        objectCount,
        headType
    });
};

export const logModelViewOperation = (headType: THeadType, type: 'isometric' | 'front' | 'top' | 'left' | 'right' | 'fit_view_in') => {
    return sendMessage(`${headType}_model_view_${type}`, 'model_view', {
        headType
    });
};

export const logPritingSlice = (headType: THeadType, profileStatus: {
    defaultMaterialL: string,
    defaultMaterialR: string,
    defaultMaterialQuality: string
}, sliceSetting?: string) => {
    return sendMessage(`${headType}_slice`, 'slice', {
        headType,
        defaultMaterialL: profileStatus.defaultMaterialL,
        defaultMaterialR: profileStatus.defaultMaterialR,
        defaultMaterialQuality: profileStatus.defaultMaterialQuality,
        sliceSetting
    });
};

export const logSvgSlice = (headType: THeadType, toolpathsCount: number) => {
    return sendMessage(`${headType}_slice`, 'slice', {
        headType,
        toolpathsCount
    });
};

export const logProfileChange = (headType: THeadType, type: string) => {
    return sendMessage(`${headType}_select_${type}`, `${headType}_flow`);
};

export const logGcodeExport = (headType: THeadType, to: 'local' | 'workspace', isRotate?: boolean) => {
    const projectType = getProjectType(headType, isRotate);
    return sendMessage(`${headType}_export_${to}`, 'export_gcode', {
        headType,
        projectType
    });
};

export const initialize = (userId: string) => {
    if (process.env.NODE_ENV !== 'production') {
        return;
    }
    ReactGA.initialize('G-PVQS8L8HQM');
    ReactGA.gtag('set', 'user_properties', {
        'crm_id': userId
    });
    // https://stackoverflow.com/questions/36508241/how-do-i-set-appversion-for-google-analytics-event-tracking
    ReactGA.gtag('set', 'appVersion', pkg.version);
    lubanVisit();
};
