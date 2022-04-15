import i18next from 'i18next';
import ReactGA from 'react-ga4';
import { v4 as uuid } from 'uuid';
import { machineStore } from '../../store/local-storage';

type THeadType = 'printing' | 'laser' | 'cnc'

type Transformation = {
    move: 'input' | 'center' | 'axis' | 'XY' | 'arrange',
    scale: 'input_%' | 'axis',
    roate: 'input' | 'axis' | 'analyze_in' | 'analyze_out' | 'face' | 'auto',
    mirror: 'button'
    support: 'auto' | 'edit_in' | 'edit_done'
}

type ToolName = 'save' | 'undo' | 'redo' | 'align' | 'group' | 'ungroup'
    | 'job_setup' | 'top' | 'bottom' | 'camera_capture_add_backgroup' | 'camera_capture_remove_backgroup'

export function logPageView({ pathname }: { pathname: string, isRotate: boolean }) {
    if (pathname) {
        switch (pathname) {
            case '/':
                break;
            case '/printing':
            case '/workspace':
                break;
            case '/laser':
            case '/cnc':
                break;
            default:
        }
    }
}

const getToolHead = (headType: THeadType) => {
    const toolHead = machineStore.get('machine.toolHead');
    return toolHead[`${headType}Toolhead`];
};

const getProjectType = (headType: THeadType, isRotate?: boolean) => {
    if (headType === 'cnc' || headType === 'laser') {
        headType += isRotate ? '_4axis' : '_3axis';
    }
    return headType;
};

const sendMessage = (messageType: string, category: string, data: Record<string, string | number> = {}) => {
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

// TODO 推出Luban清除projectId
const lubanVisit = () => {
    return sendMessage('luban_visit', 'user');
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

export const logObjectListOperation = (headType: THeadType, type: 'pack' | 'expand', objectCount: number) => {
    return sendMessage(`${headType}_object_list_${type}`, 'object_list', {
        objectCount
    });
};

export const logModelViewOperation = (headType: THeadType, type: 'isometric' | 'front' | 'top' | 'left' | 'right') => {
    return sendMessage(`${headType}_model_view_${type}`, 'model_view');
};

export const logPritingSlice = (headType: THeadType, profileFrom: {
    isDefault: boolean,
    updatedDefault: boolean
}, printingFrom?: {
    isDefault: boolean,
    updatedDefault: boolean
}, sliceSetting?: string) => {
    const profileFromUpdatedDefault = profileFrom.updatedDefault ? '1' : '0';
    const defaultMaterial = profileFrom.isDefault ? profileFromUpdatedDefault : '2';
    const printingFromUpdatedDefault = printingFrom.updatedDefault ? '1' : '0';
    const defaultPrintingSetting = printingFrom.isDefault ? printingFromUpdatedDefault : '2';

    return sendMessage(`${headType}_slice`, 'slice', {
        headType,
        defaultMaterial,
        defaultPrintingSetting,
        sliceSetting
    });
};

export const logSvgSlice = (headType: THeadType, profileFrom: {
    isDefault: boolean,
    updatedDefault: boolean
}, toolpathCount: number) => {
    const profileFromUpdatedDefault = profileFrom.updatedDefault ? '1' : '0';
    const defaultProfile = profileFrom.isDefault ? profileFromUpdatedDefault : '2';

    return sendMessage(`${headType}_slice`, 'slice', {
        headType,
        defaultProfile,
        toolpathCount
    });
};

export const logProfileChange = (headType: THeadType, type: 'material' | 'printing_setting') => {
    return sendMessage(`${headType}_select_${type}`, `${headType}_flow`);
};

export const logGcodeExport = (headType: THeadType, to: 'local' | 'workspace', isRotate?: boolean) => {
    const projectType = getProjectType(headType, isRotate);
    return sendMessage(`${headType}_export_${to}`, 'export_gcode', {
        projectType
    });
};

export const initialize = (userId: string) => {
    ReactGA.initialize('G-CZ95MGND3N');
    ReactGA.gtag('set', 'user_properties', {
        'crm_id': userId
    });
    ReactGA.gtag('config', 'G-CZ95MGND3N', {
        custom_map: {
            dimension0: 'messageType',
            metric0: 'num'
        }
        // debug_mode: true
    });

    lubanVisit();
};

export default {
    logPageView,
    logModuleVisit,
    logToolBarOperation,
    logTransformOperation,
    logObjectListOperation,
    logModelViewOperation,
    logPritingSlice,
    logSvgSlice,
    logProfileChange,
    logGcodeExport,
    initialize
};
