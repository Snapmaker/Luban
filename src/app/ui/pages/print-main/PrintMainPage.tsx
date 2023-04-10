import i18next from 'i18next';
import isElectron from 'is-electron';
import { find } from 'lodash';
// import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useHistory, withRouter } from 'react-router-dom';

import { LEFT_EXTRUDER, PRINTING_MANAGER_TYPE_MATERIAL } from '../../../constants';
import { HEAD_PRINTING, isDualExtruder, MACHINE_SERIES } from '../../../constants/machines';
import { RootState } from '../../../flux/index.def';
import { actions as machineActions } from '../../../flux/machine';
import { actions as printingActions } from '../../../flux/printing';
import { actions as projectActions } from '../../../flux/project';
import i18n from '../../../lib/i18n';
import modal from '../../../lib/modal';
import { machineStore } from '../../../store/local-storage';
import Dropzone from '../../components/Dropzone';
import MainToolBar from '../../layouts/MainToolBar';
import ProjectLayout from '../../layouts/ProjectLayout';
import { logPageView, renderPopup, useUnsavedTitle } from '../../utils';
import PrintingManager from '../../views/PrintingManager';
import PrintingConfigurationsWidget, { PresetInitialization } from '../../widgets/PrintingConfigurationWidget';
import PrintingOutputWidget from '../../widgets/PrintingOutput';
import Thumbnail from '../../widgets/PrintingOutput/Thumbnail';
import PrintingVisualizer from '../../widgets/PrintingVisualizer';
import sceneLogic from '../../../scene/scene.logic';

import HomePage from '../HomePage';
import { CaseConfigGimbal, CaseConfigPenHolder, CaseConfigSM2Gimbal } from '../HomePage/CaseConfig';
import MachineMaterialSettings from '../MachineMaterialSettings';
import { PageMode } from '../PageMode';
import Workspace from '../Workspace';
import SceneInitialization from './SceneInitialization';
import StarterGuide from './StarterGuide';

export const openFolder = () => {
    if (isElectron()) {
        const ipc = window.require('electron').ipcRenderer;
        ipc.send('open-recover-folder');
    }
};

const pageHeadType = HEAD_PRINTING;

function useRenderMainToolBar(pageMode, setPageMode, profileInitialized = false) {
    const unSaved = useSelector((state: RootState) => state.project[pageHeadType]?.unSaved, shallowEqual);

    const { series, toolHead } = useSelector((state: RootState) => state.machine);

    const { inProgress, simplifyType, simplifyPercent } = useSelector((state: RootState) => state.printing, shallowEqual);
    const enableShortcut = useSelector((state: RootState) => state.printing?.enableShortcut, shallowEqual);

    // undo & redo
    const canRedo = useSelector((state: RootState) => state.printing?.history?.canRedo, shallowEqual);
    const canUndo = useSelector((state: RootState) => state.printing?.history?.canUndo, shallowEqual);

    // group actions
    const canGroup = useSelector((state: RootState) => state.printing?.modelGroup?.canGroup());
    const canUngroup = useSelector((state: RootState) => state.printing?.modelGroup?.canUngroup());
    const canMerge = useSelector((state: RootState) => state.printing?.modelGroup?.canMerge());
    const canSplit = sceneLogic.canSplit();

    // simplify & repair
    const canSimplify = useSelector((state: RootState) => state.printing?.modelGroup?.canSimplify());
    const canRepair = useSelector((state: RootState) => state.printing?.modelGroup?.canRepair());

    const [showHomePage, setShowHomePage] = useState(false);
    const [showWorkspace, setShowWorkspace] = useState(false);
    const [showMachineMaterialSettings, setShowMachineMaterialSettings] = useState(false);
    const seriesRef = useRef(series);
    const toolHeadRef = useRef(toolHead);
    const [currentSeries, setCurrentSeries] = useState(series);
    const [currentToolhead, setCurrentToolHead] = useState(toolHead.printingToolhead);


    const dispatch = useDispatch();

    function renderHomepage() {
        const onClose = () => {
            setShowHomePage(false);
            logPageView({
                pathname: '/printing'
            });
        };
        return showHomePage && renderPopup({
            onClose,
            component: HomePage,
            key: 'homepage'
        });
    }

    function renderWorkspace() {
        const onClose = () => {
            setShowWorkspace(false);
            logPageView({
                pathname: '/printing'
            });
        };
        return showWorkspace && renderPopup({
            onClose,
            component: Workspace,
            key: 'workspace'
        });
    }

    function renderMachineMaterialSettings() {
        const onClose = async () => {
            setShowMachineMaterialSettings(false);
            if (currentSeries !== seriesRef.current || currentToolhead !== toolHeadRef.current.printingToolhead) {
                dispatch(machineActions.updateMachineSeries(currentSeries));
                dispatch(machineActions.setZAxisModuleState(currentSeries === MACHINE_SERIES.ORIGINAL_LZ.identifier));
                dispatch(machineActions.updateMachineToolHead({
                    ...toolHead,
                    printingToolhead: currentToolhead
                }, currentSeries));
                await dispatch(projectActions.clearSavedEnvironment(HEAD_PRINTING));
                window.location.href = '/';
            }
        };
        const onCallBack = (_series, _toolHead) => {
            setCurrentSeries(_series);
            setCurrentToolHead(_toolHead.printingToolhead);
        };
        return showMachineMaterialSettings && renderPopup({
            onClose,
            component: MachineMaterialSettings,
            key: 'machineMaterialSettings',
            onCallBack: onCallBack
        });
    }

    /**
     * Render main tool bar on the top.
     *
     * @param activeMachine
     * @param materialInfo
     * @param isConnected
     * @returns {*}
     */
    function renderMainToolBar(activeMachine, materialInfo, isConnected) {
        //
        //
        //
        const leftItems = [
            {
                title: i18n._('key-Printing/Page-Home'),
                disabled: inProgress,
                type: 'button',
                name: 'MainToolbarHome',
                action: () => {
                    setShowHomePage(true);
                }
            },
            {
                title: i18n._('key-Printing/Page-Workspace'),
                type: 'button',
                name: 'MainToolbarWorkspace',
                action: () => {
                    setShowWorkspace(true);
                }
            },
            {
                type: 'separator',
                name: 'separator'
            },
            {
                title: i18n._('key-Printing/Page-Save'),
                disabled: !unSaved || !enableShortcut,
                type: 'button',
                name: 'MainToolbarSave',
                iconClassName: 'printing-save-icon',
                action: () => {
                    dispatch(projectActions.save(HEAD_PRINTING));
                }
            },
            {
                title: i18n._('key-Printing/Page-Undo'),
                disabled: !canUndo || !enableShortcut,
                type: 'button',
                name: 'MainToolbarUndo',
                action: () => {
                    dispatch(printingActions.undo());
                }
            },
            {
                title: i18n._('key-Printing/Page-Redo'),
                disabled: !canRedo || !enableShortcut,
                type: 'button',
                name: 'MainToolbarRedo',
                action: () => {
                    dispatch(printingActions.redo());
                }
            },
            {
                type: 'separator',
                name: 'separator'
            },
            {
                className: 'print-edit-model-intro',
                children: [
                    {
                        title: i18n._('key-3DP/MainToolBar-Align'),
                        disabled: !canMerge || !enableShortcut,
                        type: 'button',
                        name: 'MainToolbarMerge',
                        action: () => {
                            dispatch(printingActions.groupAndAlign());
                        }
                    },
                    {
                        title: i18n._('key-3DP/MainToolBar-Split'),
                        disabled: !canSplit || !enableShortcut,
                        type: 'button',
                        name: 'MainToolbarMerge',
                        action: () => {
                            dispatch(printingActions.splitSelected());
                        }
                    },
                    {
                        title: i18n._('key-3DP/MainToolBar-Group'),
                        disabled: !canGroup || !enableShortcut,
                        type: 'button',
                        name: 'MainToolbarGroup',
                        action: () => {
                            dispatch(printingActions.group());
                        }
                    },
                    {
                        title: i18n._('key-3DP/MainToolBar-Ungroup'),
                        disabled: !canUngroup || !enableShortcut,
                        type: 'button',
                        name: 'MainToolbarUngroup',
                        action: () => {
                            dispatch(printingActions.ungroup());
                        }
                    },
                    {
                        type: 'separator',
                        name: 'separator'
                    },
                    {
                        title: i18n._('key-3DP/MainToolBar-Model Simplify'),
                        disabled: !canSimplify || !enableShortcut,
                        type: 'button',
                        name: 'MainToolbarSimplifiedModel',
                        action: async () => {
                            if (pageMode === PageMode.Simplify) {
                                // Click again will not exit simplify page mode
                                // setPageMode(PageMode.Default);
                            } else {
                                setPageMode(PageMode.Simplify);
                                const repaired = await dispatch(printingActions.isModelsRepaired());
                                if (repaired) {
                                    dispatch(printingActions.modelSimplify(simplifyType, simplifyPercent, true));
                                } else {
                                    // TODO: popup a notification? or just disable the button
                                }
                            }
                        }
                    },
                    {
                        title: i18n._('key-3DP/MainToolBar-Model repair'),
                        disabled: !canRepair || !enableShortcut,
                        type: 'button',
                        name: 'MainToolbarFixModel',
                        action: () => {
                            dispatch(printingActions.repairSelectedModels());
                        }
                    },
                    {
                        type: 'separator',
                        name: 'separator'
                    },
                ]
            },
            {
                title: i18n._('Mode'),
                disabled: !profileInitialized,
                type: 'button',
                name: 'MainToolbarMode',
                action: () => {
                    if (pageMode === PageMode.ChangePrintMode) {
                        setPageMode(PageMode.Default);
                    } else if (pageMode === PageMode.Default) {
                        setPageMode(PageMode.ChangePrintMode);
                    }
                },
            },
            {
                title: i18n._('key-Printing/MainToolBar-Materials'),
                disabled: !profileInitialized,
                type: 'button',
                name: 'MainToolbarMaterialSetting',
                action: () => {
                    dispatch(printingActions.updateManagerDisplayType(PRINTING_MANAGER_TYPE_MATERIAL));
                    dispatch(printingActions.updateShowPrintingManager(true));
                },
            },
            {
                title: i18n._('key-Printing/MainToolBar-Print Settings'),
                disabled: !profileInitialized,
                type: 'button',
                name: 'MainToolbarPrintingSetting',
                action: () => {
                    dispatch(printingActions.updateState({
                        showPrintParameterModifierDialog: LEFT_EXTRUDER,
                    }));
                },
            },
        ];

        return (
            <MainToolBar
                leftItems={leftItems}
                profileInitialized={profileInitialized}
                lang={i18next.language}
                headType={HEAD_PRINTING}
                hasMachineSettings
                activeMachine={activeMachine}
                materialInfo={materialInfo}
                isConnected={isConnected}
                setShowMachineMaterialSettings={(show) => {
                    seriesRef.current = series;
                    toolHeadRef.current = toolHead;
                    setShowMachineMaterialSettings(show);
                }}
            />
        );
    }

    return [renderHomepage, renderMainToolBar, renderWorkspace, renderMachineMaterialSettings];
}

function getStarterProject(series, isDual) {
    const pathConfigForOriginal = {
        path: './UserCase/printing/original_single/3dp_original_single.snap3dp',
        name: '3dp_original_single.snap3dp'
    };

    // TODO: Refactor to not hard coding
    let pathConfig;
    if ([MACHINE_SERIES.ORIGINAL.identifier, MACHINE_SERIES.ORIGINAL_LZ.identifier].includes(series)) {
        pathConfig = pathConfigForOriginal;
    } else if (series === MACHINE_SERIES.A400.identifier) {
        pathConfig = CaseConfigPenHolder.pathConfig;
    } else if (series === MACHINE_SERIES.J1.identifier) {
        pathConfig = CaseConfigGimbal.pathConfig;
    } else {
        // SM 2.0
        if (isDual) {
            pathConfig = CaseConfigSM2Gimbal.pathConfig;
        } else if (series === MACHINE_SERIES.A150.identifier) {
            pathConfig = {
                path: './UserCase/printing/a150_single/3dp_a150_single.snap3dp',
                name: '3dp_a150_single.snap3dp'
            };
        } else if (series === MACHINE_SERIES.A250.identifier) {
            pathConfig = {
                path: './UserCase/printing/a250_single/3dp_a250_single.snap3dp',
                name: '3dp_a250_single.snap3dp'
            };
        } else if (series === MACHINE_SERIES.A350.identifier) {
            pathConfig = {
                path: './UserCase/printing/a350_single/3dp_a350_single.snap3dp',
                name: '3dp_a350_single.snap3dp'
            };
        }
    }
    return pathConfig;
}

declare interface PrintMainPageProps {
    location: object;
}

const Printing: React.FC<PrintMainPageProps> = ({ location }) => {
    const materialDefinitions = useSelector(state => state?.printing?.materialDefinitions);
    const defaultMaterialId = useSelector(state => state?.printing?.defaultMaterialId);
    const defaultMaterialIdRight = useSelector(state => state?.printing?.defaultMaterialIdRight);
    const leftMaterial = find(materialDefinitions, { definitionId: defaultMaterialId });
    const rightMaterial = find(materialDefinitions, { definitionId: defaultMaterialIdRight });

    const series = useSelector(state => state?.machine?.series);
    const { toolHead: { printingToolhead } } = useSelector(state => state.machine, shallowEqual);
    const activeMachine = useSelector(state => state.machine.activeMachine);

    const {
        isConnected,
    } = useSelector(state => state.workspace, shallowEqual);

    const isDual = isDualExtruder(printingToolhead);

    // const [isDraggingWidget, setIsDraggingWidget] = useState(false);
    const [materialInfo, setMaterialInfo] = useState({});
    // for simplify model, if true, visaulizerLeftbar and main tool bar can't be use
    const [pageMode, setPageMode] = useState(PageMode.Default);

    const dispatch = useDispatch();
    const history = useHistory();
    const [
        renderHomepage, renderMainToolBar, renderWorkspace, renderMachineMaterialSettings
    ] = useRenderMainToolBar(pageMode, setPageMode, !!materialDefinitions.length);
    const modelGroup = useSelector(state => state.printing.modelGroup);
    const thumbnail = useRef();
    useUnsavedTitle(pageHeadType);

    useEffect(() => {
        (async () => {
            if (!location?.state?.initialized) {
                await dispatch(printingActions.init());
            }
        })();

        // Make sure execute 'initSocketEvent' after 'printingActions.init' on openning project
        setTimeout(() => {
            dispatch(printingActions.initSocketEvent());
        }, 50);
        dispatch(printingActions.checkNewUser());

        logPageView({
            pathname: '/printing'
        });
    }, []);

    useEffect(() => {
        const material = {
            leftExtruder: {
                name: leftMaterial?.name,
                color: leftMaterial?.settings?.color?.default_value
            }
        };

        if (isDualExtruder(printingToolhead)) {
            material.rightExtruder = {
                name: rightMaterial?.name,
                color: rightMaterial?.settings?.color?.default_value
            };
        }

        setMaterialInfo(material);
        renderMainToolBar(activeMachine, material, isConnected);
    }, [activeMachine, series, leftMaterial, rightMaterial, printingToolhead]);

    // Determine page mode
    useEffect(() => {
        // Switch to ChangePrintMode page mode when first enter the page, if the machine has
        // more than 1 print mode.
        if (activeMachine) {
            const printModes = activeMachine.metadata?.printModes;
            if (printModes?.length > 1) {
                setPageMode(PageMode.ChangePrintMode);
            }
        }
    }, [activeMachine]);

    useEffect(() => {
        renderMainToolBar(activeMachine, materialInfo, isConnected);
    }, [isConnected]);

    const onDropAccepted = useCallback(async (files) => {
        await dispatch(printingActions.uploadModel(files));
    }, [dispatch]);

    const onDropRejected = useCallback(() => {
        const title = i18n._('key-Printing/Page-Warning');
        const body = i18n._('key-Printing/Page-Only STL/OBJ files are supported.');
        modal({
            title: title,
            cancelTitle: i18n._('key-Workspace/WorkflowControl-Close'),
            body: body
        });
    }, []);

    const renderModalView = useCallback(() => {
        return (<PrintingManager />);
    }, []);

    const renderRightView = useCallback(() => {
        return (
            <div className="sm-flex sm-flex-direction-c height-percent-100">
                <PrintingConfigurationsWidget
                    className="margin-bottom-8 sm-flex-width"
                />
                <PrintingOutputWidget />
            </div>
        );
    }, []);

    // section - Starter Guide
    const [starterGuideEnabled, setStarterGuideEnabled] = useState(false);

    useEffect(() => {
        if (location?.state?.shouldShowGuideTours) {
            setStarterGuideEnabled(true);
        } else {
            setStarterGuideEnabled(false);
        }
    }, [location?.state?.shouldShowGuideTours]);

    useEffect(() => {
        if (typeof (starterGuideEnabled) === 'boolean' && !starterGuideEnabled) {
            machineStore.set('guideTours.guideTours3dp', true);
        }
    }, [starterGuideEnabled]);

    const onStarterGuideChange = useCallback(async (nextIndex) => {
        if (nextIndex === 1) {
            // setInitIndex(1);

            const projectConfig = getStarterProject(series, isDual);

            dispatch(projectActions.openProject(projectConfig, history, true, true));
        }
    }, [series, isDual, dispatch, history]);

    const onStarterGuideExit = useCallback(() => {
        setStarterGuideEnabled(false);
    }, []);

    return (
        <ProjectLayout
            renderMainToolBar={() => renderMainToolBar(activeMachine, materialInfo, isConnected)}
            renderRightView={renderRightView}
            renderModalView={renderModalView}
        >

            {/* initialization of the scene */}
            <SceneInitialization />
            {/* Visualizer */}
            <Dropzone
                multiple
                disabled={false}
                accept=".stl, .obj, .3mf, .amf"
                dragEnterMsg={i18n._('key-Printing/Page-Drop an STL/OBJ file here.')}
                onDropAccepted={onDropAccepted}
                onDropRejected={onDropRejected}
            >
                <PrintingVisualizer
                    widgetId="printingVisualizer"
                    pageMode={pageMode}
                    setPageMode={setPageMode}
                />

                <StarterGuide
                    enabled={starterGuideEnabled}
                    onChange={onStarterGuideChange}
                    onExit={onStarterGuideExit}
                />
            </Dropzone>
            {renderHomepage()}
            {renderWorkspace()}
            {renderMachineMaterialSettings()}
            <Thumbnail
                ref={thumbnail}
                modelGroup={modelGroup}
            />
            {/* initialization of selected presets */}
            <PresetInitialization />
        </ProjectLayout>
    );
};

export default withRouter(Printing);
