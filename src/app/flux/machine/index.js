import _, { cloneDeep, uniq } from 'lodash';

import setting from '../../config/settings';
import {
    HEAD_CNC,
    HEAD_LASER,
    HEAD_PRINTING,
    LEFT_EXTRUDER,
    RIGHT_EXTRUDER,
} from '../../constants';
import {
    LEVEL_ONE_POWER_LASER_FOR_ORIGINAL,
    MACHINE_SERIES,
    MACHINE_TOOL_HEADS,
    SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL,
    STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL,
    findMachineByName,
    getMachineToolOptions
} from '../../constants/machines';
import { valueOf } from '../../lib/contants-utils';
import { controller } from '../../communication/socket-communication';
import i18n from '../../lib/i18n';
import log from '../../lib/log';
import { SnapmakerOriginalMachine } from '../../machines';
import { PresetModel } from '../../preset-model';
import { machineStore, printingStore } from '../../store/local-storage';
import { actions as editorActions } from '../editor';
import { actions as printingActions } from '../printing';
import { actions as widgetActions } from '../widget';
import baseActions, { ACTION_UPDATE_STATE } from './action-base';

/* eslint-disable import/no-cycle */
import definitionManager from '../manager/DefinitionManager';

const INITIAL_STATE = {
    printingArrangeSettings: {
        angle: 30,
        offset: 5,
        padding: 5
    },

    // Machine Info
    series: SnapmakerOriginalMachine.identifier,
    toolHead: {
        printingToolhead:
            MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL].value,
        laserToolhead:
            MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_ORIGINAL].value,
        cncToolhead:
            MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL].value
    },
    modules: [],

    /**
     * Active machine object.
     */
    activeMachine: null,

    size: MACHINE_SERIES.ORIGINAL.metadata.size,

    // Serial port

    zAxisModule: null,

    // region Machine Status 2 TODO
    laserPower: null,
    headStatus: null,

    // endregion

    printingCustomConfigs: [
        'layer_height',
        'infill_sparse_density',
        'wall_thickness',
        'adhesion_type',
        'support_enable'
    ],

    printingCustomConfigsWithCategory: {
        quality: ['layer_height'],
        model_structure: ['infill_sparse_density', 'wall_thickness'],
        platform_adhesion: ['adhesion_type']
    },

    // security warning
    shouldShowCncWarning: true,

    // region Auto Update
    autoupdateMessage: '',
    // Whether to check for available updates when the software is opened
    shouldCheckForUpdate: true,
    // Whether an update is being downloaded
    isDownloading: false,
    // endregion
    use4Axis: true,
    // use multiple engine
    multipleEngine: false,
    // Whether auto preview file when import G code to workspace
    shouldAutoPreviewGcode: true,
    // Whether hide console when machine is working
    shouldHideConsole: true,
    promptDamageModel: true,
    enable3dpLivePreview: false,
    // wifi connection, home button in control widget
    homingModal: false,
};

export const actions = {
    // Initialize machine, get machine configurations via API
    init: () => (dispatch, getState) => {
        actions.__initMachine(dispatch);

        actions.__initCNCSecurityWarning(dispatch);

        // actions.__init4Axis(dispatch);

        if (machineStore.get('shouldCheckForUpdate') === false) {
            const shouldCheckForUpdate = false;
            dispatch(
                baseActions.updateState({
                    shouldCheckForUpdate: shouldCheckForUpdate
                })
            );
        }
        const printingArrangeSettings = printingStore.get(
            'printingArrangeSettings'
        );
        if (printingArrangeSettings) {
            try {
                const newArrangeSettings = JSON.parse(printingArrangeSettings);
                dispatch(
                    baseActions.updateState({
                        printingArrangeSettings: newArrangeSettings
                    })
                );
            } catch (e) {
                log.error(e);
            }
        }
        const printingCustomConfigs = machineStore.get('printingCustomConfigs');
        const printingCustomConfigsWithCategory = machineStore.get('printingCustomConfigsWithCategory');
        if (
            printingCustomConfigs
            && Object.prototype.toString.call(printingCustomConfigs)
            === '[object String]'
        ) {
            const customConfigsArray = printingCustomConfigs.split('-');
            dispatch(
                baseActions.updateState({
                    printingCustomConfigs: customConfigsArray
                })
            );
        }

        if (printingCustomConfigsWithCategory) {
            const tempConfigs = {};
            Object.keys(printingCustomConfigsWithCategory).forEach(category => {
                tempConfigs[category] = uniq(printingCustomConfigsWithCategory[category]);
            });
            dispatch(baseActions.updateState({
                printingCustomConfigsWithCategory: tempConfigs
            }));
        }

        if (machineStore.get('shouldAutoPreviewGcode') === false) {
            dispatch(
                baseActions.updateState({
                    shouldAutoPreviewGcode: false
                })
            );
        }
        if (machineStore.get('shouldHideConsole') === false) {
            dispatch(baseActions.updateState({
                shouldHideConsole: false
            }));
        }
        if (machineStore.get('promptDamageModel') === false) {
            dispatch(
                baseActions.updateState({
                    promptDamageModel: false
                })
            );
        }
        if (machineStore.get('enable3dpLivePreview') === false) {
            const { modelGroup } = getState().printing;
            modelGroup.setClipperEnable(false);
            dispatch(
                baseActions.updateState({
                    enable3dpLivePreview: false
                })
            );
        }
    },

    /**
     * Initialize machine related attributes, series, machine size, etc.
     */
    __initMachine: (dispatch) => {
        // Machine
        const {
            series = INITIAL_STATE.series,
            toolHead = INITIAL_STATE.toolHead,
            modules = INITIAL_STATE.modules,
        } = machineStore.get('machine') || {};

        let machine = findMachineByName(series);
        let machineIdentifier = series;
        if (!machine) {
            // warning?
            machineIdentifier = SnapmakerOriginalMachine.identifier;
            machine = SnapmakerOriginalMachine;
        }

        for (const headType of [HEAD_PRINTING, HEAD_LASER, HEAD_CNC]) {
            const headTypeKey = `${headType}Toolhead`; // historical key
            const identifier = toolHead[headTypeKey];

            let toolHeadOptions = machine.metadata.toolHeads.find(toolHeadOption => toolHeadOption.identifier === identifier);
            if (!toolHeadOptions) {
                if (machine.metadata.toolHeads.length) {
                    toolHeadOptions = machine.metadata.toolHeads[0]; // First choice
                    log.warn(`Missing toolHead, use default toolhead option: ${toolHeadOptions.identifier}`);
                }
            }

            toolHead[headTypeKey] = toolHeadOptions.identifier;
        }

        dispatch(
            baseActions.updateState({
                series: machineIdentifier,
                size: machine.metadata.size,
                toolHead,
                modules,
                activeMachine: machine,
            })
        );

        dispatch(editorActions.onSizeUpdated('laser', machine.metadata.size));
        dispatch(editorActions.onSizeUpdated('cnc', machine.metadata.size));
    },

    __initCNCSecurityWarning: (dispatch) => {
        // Load CNC security warning
        const savedData = machineStore.get('settings.shouldShowCncWarning');
        let shouldShowCncWarning = INITIAL_STATE.shouldShowCncWarning;
        if (savedData && typeof savedData === 'string') {
            const currentVersion = setting.version;

            // shouldShowCncWarning: '3.10.0|false'
            const [version, value] = savedData.split('|');
            if (version === currentVersion && value === 'false') {
                shouldShowCncWarning = false;
            }
        }

        dispatch(
            baseActions.updateState({
                shouldShowCncWarning
            })
        );
    },

    __init4Axis: (dispatch) => {
        const use4Axis = machineStore.get('settings.use4Axis');

        dispatch(
            baseActions.updateState({
                use4Axis: use4Axis === 'true' || use4Axis === true
            })
        );
    },

    updateMachineState: (state) => (dispatch) => {
        const { series, headType } = state;
        headType
            && dispatch(
                baseActions.updateState({
                    headType: headType
                })
            );

        series && dispatch(actions.updateMachineSeries(series));
    },

    onChangeMachineSeries: (toolHead, series) => async (
        dispatch,
        getState
    ) => {
        machineStore.set('machine.series', series);
        machineStore.set('machine.toolHead', toolHead);

        function chooseMaterial(materialDefinitions, materialId) {
            const material = materialDefinitions.find((item) => materialId === item.definitionId);
            if (material) {
                return materialId;
            }

            return materialDefinitions[0].definitionId;
        }

        const oldToolHead = getState().machine.toolHead;
        const oldSeries = getState().machine.series;
        if (oldSeries !== series || !_.isEqual(oldToolHead, toolHead)) {
            dispatch(actions.updateMachineSeries(series));
            dispatch(actions.updateMachineToolHead(toolHead, series));

            const machineToolOptions = getMachineToolOptions(series, toolHead[HEAD_PRINTING]);
            if (!machineToolOptions) {
                return;
            }

            await definitionManager.init(HEAD_PRINTING, machineToolOptions.configPath);

            const allMaterialDefinitions = await definitionManager.getDefinitionsByPrefixName(
                'material'
            );

            let { defaultMaterialId, defaultMaterialIdRight } = getState().printing;

            defaultMaterialId = chooseMaterial(allMaterialDefinitions, defaultMaterialId);
            defaultMaterialIdRight = chooseMaterial(allMaterialDefinitions, defaultMaterialIdRight);

            const materialPresetModels = allMaterialDefinitions.map(definition => new PresetModel(definition));

            dispatch(printingActions.updateState({
                materialDefinitions: materialPresetModels,
                defaultMaterialId,
                defaultMaterialIdRight
            }));
            dispatch(printingActions.updateDefaultMaterialId(
                defaultMaterialId,
                LEFT_EXTRUDER
            ));
            dispatch(printingActions.updateDefaultMaterialId(
                defaultMaterialIdRight,
                RIGHT_EXTRUDER
            ));
        }
    },

    updateMachineSeries: (series) => async (dispatch, getState) => {
        machineStore.set('machine.series', series);

        const oldSeries = getState().machine.series;
        if (oldSeries === series) {
            return;
        }

        // Update machine as well
        const machine = findMachineByName(series);
        dispatch(baseActions.updateState({
            machine: machine
        }));

        // dispatch(baseActions.updateState({ series }));
        const seriesInfo = valueOf(MACHINE_SERIES, 'value', series);

        seriesInfo && dispatch(actions.updateMachineSize(seriesInfo.size));
        dispatch(widgetActions.updateMachineSeries(series));


        // TODO: machine hard-coded here, refactor later.
        if (series === MACHINE_SERIES.ORIGINAL.identifier) {
            dispatch(actions.setZAxisModuleState(0));
        }
        if (series === MACHINE_SERIES.ORIGINAL_LZ.identifier) {
            dispatch(actions.setZAxisModuleState(1));
        }
    },

    updateMachineToolHead: (toolHead, series, headType = null) => (
        dispatch,
        getState
    ) => {
        machineStore.set('machine.toolHead', toolHead);
        const oldToolHead = getState().machine.toolHead;
        const oldSeries = getState().machine.series;
        if (
            !_.isEqual(oldToolHead, toolHead)
            || oldSeries !== series
            || headType
        ) {
            if (!_.isEqual(oldToolHead, toolHead)) {
                dispatch(baseActions.updateState({ toolHead }));
            }
        }
    },

    setMachineModules: (machineModules) => {
        return (dispatch) => {
            if (machineModules.length > 0) {
                machineStore.set('machine.modules', machineModules);
            } else {
                machineStore.unset('machine.modules');
            }

            dispatch(baseActions.updateState({
                modules: machineModules,
            }));
        };
    },

    updateMachineSize: (size) => (dispatch) => {
        size.x = Math.min(size.x, 1000);
        size.y = Math.min(size.y, 1000);
        size.z = Math.min(size.z, 1000);

        dispatch(baseActions.updateState({ size: { ...size } }));

        dispatch(editorActions.onSizeUpdated('laser', size));
        dispatch(editorActions.onSizeUpdated('cnc', size));
    },

    // region Enclosure
    getEnclosureState: () => () => {
        controller.writeln('M1010', { source: 'query' });
    },
    setEnclosureState: (doorDetection) => () => {
        controller.writeln(`M1010 S${doorDetection ? '1' : '0'}`, {
            source: 'query'
        });
    },
    // endregion

    // region Z axis
    // for z-axis extension module
    getZAxisModuleState: () => () => {
        // TODO: waiting for query interface
        // controller.writeln('M503', { source: 'query' });
    },
    setZAxisModuleState: (moduleId) => () => {
        controller.writeln(`M1025 M${moduleId}`, { source: 'query' });
    },
    // endregion

    setShouldShowCncWarning: (value) => (dispatch) => {
        const version = setting.version;
        machineStore.set(
            'settings.shouldShowCncWarning',
            `${version}|${value}`
        );
        dispatch(
            baseActions.updateState({
                shouldShowCncWarning: value
            })
        );
    },

    // region Auto Update (need refactor)
    // TODO: Move Auto-Update code somewhere else.
    updateAutoupdateMessage: (autoupdateMessage) => (dispatch) => {
        dispatch(
            baseActions.updateState({
                autoupdateMessage: i18n._(autoupdateMessage)
            })
        );
    },
    updateIsDownloading: (isDownloading) => (dispatch) => {
        dispatch(baseActions.updateState({ isDownloading: isDownloading }));
    },
    updateShouldCheckForUpdate: (shouldCheckForUpdate) => (dispatch) => {
        dispatch(
            baseActions.updateState({
                shouldCheckForUpdate: shouldCheckForUpdate
            })
        );
        machineStore.set('shouldCheckForUpdate', shouldCheckForUpdate);
    },
    updateArrangeSettings: (printingArrangeSettings) => (dispatch) => {
        dispatch(baseActions.updateState({ printingArrangeSettings }));
        printingStore.set(
            'printingArrangeSettings',
            JSON.stringify(printingArrangeSettings)
        );
    },
    updatePrintingCustomConfigs: (printingCustomConfigs) => (dispatch) => {
        dispatch(baseActions.updateState({ printingCustomConfigs }));
        const newConfig = printingCustomConfigs.join('-');
        machineStore.set('printingCustomConfigs', newConfig);
    },
    updatePrintingCustomConfigsWithCategory: (printingCustomConfigs, category) => async (dispatch, getState) => {
        const { printingCustomConfigsWithCategory } = getState().machine;
        const newConfig = cloneDeep(printingCustomConfigsWithCategory);
        newConfig[category] = printingCustomConfigs;
        await dispatch(baseActions.updateState({
            printingCustomConfigsWithCategory: newConfig
        }));
        machineStore.set('printingCustomConfigsWithCategory', newConfig);
    },
    updateMultipleEngine: () => (dispatch, getState) => {
        const { multipleEngine } = getState().machine;
        dispatch(baseActions.updateState({ multipleEngine: !multipleEngine }));
    },
    updateShouldAutoPreviewGcode: (shouldAutoPreviewGcode) => (dispatch) => {
        dispatch(
            baseActions.updateState({
                shouldAutoPreviewGcode: shouldAutoPreviewGcode
            })
        );
        machineStore.set('shouldAutoPreviewGcode', shouldAutoPreviewGcode);
    },
    updateShouldHideConsole: (shouldHideConsole) => (dispatch) => {
        dispatch(baseActions.updateState({ shouldHideConsole: shouldHideConsole }));
        machineStore.set('shouldHideConsole', shouldHideConsole);
    },
    updatePromptDamageModel: (bool) => (dispatch) => {
        dispatch(baseActions.updateState({ promptDamageModel: bool }));
        machineStore.set('promptDamageModel', bool);
    },
    updateEnable3dpLivePreview: (bool) => (dispatch, getState) => {
        const { modelGroup } = getState().printing;

        machineStore.set('enable3dpLivePreview', bool);
        dispatch(baseActions.updateState({ enable3dpLivePreview: bool }));
        modelGroup.setClipperEnable(bool);
    }
    // endregion
};

export default function reducer(state = INITIAL_STATE, action) {
    switch (action.type) {
        // action from action-base
        case ACTION_UPDATE_STATE:
            return Object.assign({}, state, action.state);
        default:
            return state;
    }
}
