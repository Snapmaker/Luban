import _, { cloneDeep, uniq } from 'lodash';
import {
    HEAD_PRINTING, LEFT_EXTRUDER,
    RIGHT_EXTRUDER,
} from '../../constants';

import {
    findMachineByName,
    getMachineSeriesWithToolhead,
    LEVEL_ONE_POWER_LASER_FOR_ORIGINAL,
    MACHINE_SERIES,
    MACHINE_TOOL_HEADS,
    SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL,
    STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL
} from '../../constants/machines';

import setting from '../../config/settings';
import log from '../../lib/log';
import { valueOf } from '../../lib/contants-utils';
import { controller } from '../../lib/controller';
import i18n from '../../lib/i18n';
import { machineStore, printingStore } from '../../store/local-storage';
import { actions as editorActions } from '../editor';
import PresetDefinitionModel from '../manager/PresetDefinitionModel';
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
    series: MACHINE_SERIES.ORIGINAL.identifier,
    toolHead: {
        printingToolhead:
        MACHINE_TOOL_HEADS[SINGLE_EXTRUDER_TOOLHEAD_FOR_ORIGINAL].value,
        laserToolhead:
        MACHINE_TOOL_HEADS[LEVEL_ONE_POWER_LASER_FOR_ORIGINAL].value,
        cncToolhead:
        MACHINE_TOOL_HEADS[STANDARD_CNC_TOOLHEAD_FOR_ORIGINAL].value
    },

    /**
     * Active machine object.
     */
    activeMachine: null,

    // currentMachine: INITIAL_MACHINE_SERIES_WITH_HEADTOOL,
    size: MACHINE_SERIES.ORIGINAL.metadata.size,
    laserSize: MACHINE_SERIES.ORIGINAL.metadata.size, // TODO: replace laserSize
    // endregion

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
        actions.__initMachineStatus(dispatch);

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
    __initMachineStatus: (dispatch) => {
        // Machine
        const {
            series = INITIAL_STATE.series,
            laserSize = INITIAL_STATE.laserSize,
            toolHead = INITIAL_STATE.toolHead
        } = machineStore.get('machine') || {};

        const machine = findMachineByName(series);
        if (!machine) {
            // warning?
            return;
        }

        dispatch(
            baseActions.updateState({
                series: series,
                size: machine.metadata.size,
                laserSize: machine.setting ? machine.setting.laserSize : laserSize,
                toolHead: toolHead,
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
            dispatch(baseActions.updateState({ series, toolHead }));

            const currentMachine = getMachineSeriesWithToolhead(series, toolHead);
            await definitionManager.init(HEAD_PRINTING, currentMachine.configPathname[HEAD_PRINTING]);

            const allMaterialDefinitions = await definitionManager.getDefinitionsByPrefixName(
                'material'
            );

            let { defaultMaterialId, defaultMaterialIdRight } = getState().printing;

            defaultMaterialId = chooseMaterial(allMaterialDefinitions, defaultMaterialId);
            defaultMaterialIdRight = chooseMaterial(allMaterialDefinitions, defaultMaterialIdRight);

            const materialPresetModels = allMaterialDefinitions.map(definition => new PresetDefinitionModel(definition));

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

        //  Do not need to 'initSize' just use 'switchSize' function
        await dispatch(printingActions.switchSize());
        seriesInfo && dispatch(actions.updateMachineSize(seriesInfo.size));
        seriesInfo && dispatch(actions.updateLaserSize(seriesInfo.setting.laserSize));
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
            // const currentMachine = getMachineSeriesWithToolhead(series, toolHead, headType);
            // dispatch(baseActions.updateState({ currentMachine }));
            if (!_.isEqual(oldToolHead, toolHead)) {
                dispatch(baseActions.updateState({ toolHead }));
            }
        }
    },

    updateMachineSize: (size) => (dispatch) => {
        size.x = Math.min(size.x, 1000);
        size.y = Math.min(size.y, 1000);
        size.z = Math.min(size.z, 1000);

        dispatch(baseActions.updateState({ size: { ...size } }));

        dispatch(editorActions.onSizeUpdated('laser', size));
        dispatch(editorActions.onSizeUpdated('cnc', size));
    },

    updateLaserSize: (laserSize) => (dispatch) => {
        if (!laserSize) {
            return;
        }
        laserSize.x = Math.min(laserSize.x, 1000);
        laserSize.y = Math.min(laserSize.y, 1000);
        laserSize.z = Math.min(laserSize.z, 1000);

        machineStore.set('machine.laserSize', laserSize);

        dispatch(baseActions.updateState({ laserSize }));
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
