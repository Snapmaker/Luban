import React, { useState, useEffect, useRef } from 'react';
import { shallowEqual, useSelector, useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { useHistory, withRouter } from 'react-router-dom';
import { find, includes, throttle } from 'lodash';
import isElectron from 'is-electron';
import i18next from 'i18next';
// import { Steps } from 'intro.js-react';
import 'intro.js/introjs.css';
import { Trans } from 'react-i18next';
import PrintingVisualizer from '../widgets/PrintingVisualizer';
// import PrintingOutput from '../widgets/PrintingOutput';
import PrintingManager from '../views/PrintingManager';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import Dropzone from '../components/Dropzone';
import { actions as printingActions } from '../../flux/printing';
import { actions as projectActions } from '../../flux/project';
import { actions as machineActions } from '../../flux/machine';
import ProjectLayout from '../layouts/ProjectLayout';
import MainToolBar from '../layouts/MainToolBar';
import { DUAL_EXTRUDER_TOOLHEAD_FOR_SM2, HEAD_PRINTING, LEFT, PRINTING_MANAGER_TYPE_MATERIAL, PRINTING_MANAGER_TYPE_QUALITY, ROTATE_MODE } from '../../constants';
import { renderPopup, renderWidgetList, logPageView, useUnsavedTitle } from '../utils';
import { machineStore } from '../../store/local-storage';

import ControlWidget from '../widgets/Control';
import ConnectionWidget from '../widgets/Connection';
import ConsoleWidget from '../widgets/Console';
import GCodeWidget from '../widgets/GCode';
import MacroWidget from '../widgets/Macro';
import PurifierWidget from '../widgets/Purifier';
import MarlinWidget from '../widgets/Marlin';
import VisualizerWidget from '../widgets/WorkspaceVisualizer';
import WebcamWidget from '../widgets/Webcam';
import LaserParamsWidget from '../widgets/LaserParams';
import LaserSetBackground from '../widgets/LaserSetBackground';
import LaserTestFocusWidget from '../widgets/LaserTestFocus';
import CNCPathWidget from '../widgets/CNCPath';
import CncLaserOutputWidget from '../widgets/CncLaserOutput';

import PrintingMaterialWidget from '../widgets/PrintingMaterial';
import PrintingConfigurationsWidget from '../widgets/PrintingConfigurations';
import PrintingOutputWidget from '../widgets/PrintingOutput';
import WifiTransport from '../widgets/WifiTransport';
import EnclosureWidget from '../widgets/Enclosure';
import Thumbnail from '../widgets/PrintingOutput/Thumbnail';
import JobType from '../widgets/JobType';
import HomePage from './HomePage';
import Workspace from './Workspace';
import {
    printIntroStepOne, printIntroStepTwo, printIntroStepThree,
    printIntroStepFour, printIntroStepFive, printIntroStepSix
} from './introContent';
import '../../styles/introCustom.styl';
import Steps from '../components/Steps';
import Modal from '../components/Modal';
import { Button } from '../components/Buttons';
import MachineMaterialSettings from './MachineMaterialSettings';

export const openFolder = () => {
    if (isElectron()) {
        const ipc = window.require('electron').ipcRenderer;
        ipc.send('open-recover-folder');
    }
};
const allWidgets = {
    'control': ControlWidget,
    'connection': ConnectionWidget,
    'console': ConsoleWidget,
    'gcode': GCodeWidget,
    'macro': MacroWidget,
    'macroPanel': MacroWidget,
    'purifier': PurifierWidget,
    'marlin': MarlinWidget,
    'visualizer': VisualizerWidget,
    'webcam': WebcamWidget,
    'printing-visualizer': PrintingVisualizer,
    'wifi-transport': WifiTransport,
    'enclosure': EnclosureWidget,
    '3dp-material': PrintingMaterialWidget,
    '3dp-configurations': PrintingConfigurationsWidget,
    // '3dp-output': PrintingOutputWidget,
    'laser-params': LaserParamsWidget,
    // 'laser-output': CncLaserOutputWidget,
    'laser-set-background': LaserSetBackground,
    'laser-test-focus': LaserTestFocusWidget,
    'cnc-path': CNCPathWidget,
    'cnc-output': CncLaserOutputWidget,
    'job-type': JobType
};


const pageHeadType = HEAD_PRINTING;
function useRenderMainToolBar(setSimplifying) {
    const unSaved = useSelector(state => state?.project[pageHeadType]?.unSaved, shallowEqual);
    const { inProgress, simplifyType, simplifyPercent } = useSelector(state => state?.printing, shallowEqual);
    const enableShortcut = useSelector(state => state?.printing?.enableShortcut, shallowEqual);
    const canRedo = useSelector(state => state?.printing?.history?.canRedo, shallowEqual);
    const canUndo = useSelector(state => state?.printing?.history?.canUndo, shallowEqual);
    const canGroup = useSelector(state => state?.printing?.modelGroup?.canGroup());
    const canMerge = useSelector(state => state?.printing?.modelGroup?.canMerge());
    const canUngroup = useSelector(state => state?.printing?.modelGroup?.canUngroup());
    // const toolHeadObj = useSelector(state => state?.machine?.toolHead);
    const canSimplify = useSelector(state => state?.printing?.modelGroup?.canSimplify());
    const canRepair = useSelector(state => state?.printing?.modelGroup?.canRepair());
    const [showHomePage, setShowHomePage] = useState(false);
    const [showWorkspace, setShowWorkspace] = useState(false);
    const [showMachineMaterialSettings, setShowMachineMaterialSettings] = useState(false);
    const { series, toolHead } = useSelector(state => state?.machine);
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
            if (currentSeries !== series || currentToolhead !== toolHead.printingToolhead) {
                dispatch(machineActions.updateMachineSeries(currentSeries));
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
    function renderMainToolBar(machineInfo, materialInfo, isConnected) {
        // const fileInput = React.createRef();
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
                type: 'separator'
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
                title: i18n._('key-3DP/MainToolBar-Align'),
                disabled: !canMerge || !enableShortcut,
                type: 'button',
                name: 'MainToolbarMerge',
                action: () => {
                    dispatch(printingActions.groupAndAlign());
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
                title: i18n._('key-3DP/MainToolBar-Model Simplify'),
                disabled: !canSimplify || !enableShortcut,
                type: 'button',
                name: 'MainToolbarSimplifiedModel',
                action: async () => {
                    const repaired = await dispatch(printingActions.isModelsRepaired());
                    if (repaired) {
                        setSimplifying(true);
                        dispatch(printingActions.modelSimplify(simplifyType, simplifyPercent, true));
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
                title: i18n._('key-3DP/MainToolBar-MaterialSetting'),
                type: 'button',
                name: 'MainToolbarMaterialSetting',
                action: () => {
                    dispatch(printingActions.updateManagerDisplayType(PRINTING_MANAGER_TYPE_MATERIAL));
                    dispatch(printingActions.updateShowPrintingManager(true, LEFT));
                }
            },
            {
                title: i18n._('key-3DP/MainToolBar-QualitySetting'),
                type: 'button',
                name: 'MainToolbarPrintingSetting',
                action: () => {
                    dispatch(
                        printingActions.updateManagerDisplayType(
                            PRINTING_MANAGER_TYPE_QUALITY
                        )
                    );
                    dispatch(printingActions.updateShowPrintingManager(true));
                }
            }
        ];
        return (
            <MainToolBar
                leftItems={leftItems}
                lang={i18next.language}
                headType={HEAD_PRINTING}
                hasMachineSettings
                machineInfo={machineInfo}
                materialInfo={materialInfo}
                isConnected={isConnected}
                setShowMachineMaterialSettings={setShowMachineMaterialSettings}
            />
        );
    }
    return [renderHomepage, renderMainToolBar, renderWorkspace, renderMachineMaterialSettings];
}

function Printing({ location }) {
    const widgets = useSelector(state => state?.widget[pageHeadType].default.widgets, shallowEqual);
    const series = useSelector(state => state?.machine?.series);
    const printingState = useSelector(state => state?.printing);
    const { materialDefinitions, defaultMaterialId, defaultMaterialIdRight } = printingState;
    const leftMaterial = find(materialDefinitions, { definitionId: defaultMaterialId });
    const rightMaterial = find(materialDefinitions, { definitionId: defaultMaterialIdRight });
    const machineState = useSelector(state => state?.machine);
    const { isConnected, toolHead: { printingToolhead } } = machineState;
    const isOriginal = includes(series, 'Original');
    const [isDraggingWidget, setIsDraggingWidget] = useState(false);
    const [enabledIntro, setEnabledIntro] = useState(null);
    const [initIndex, setInitIndex] = useState(0);
    // const [rotateInputValue, setRotateInputValue] = useState(null);
    // const [rotateAxis, setRotateAxis] = useState('x');
    const [controlInputValue, setControlInputValue] = useState(null);
    const [controlAxis, setControlAxis] = useState(['x']);
    const [controlMode, setControlMode] = useState(null);
    const [machineInfo, setMachineInfo] = useState({});
    const [materialInfo, setMaterialInfo] = useState({});
    // for simplify model, if true, visaulizerLeftbar and main tool bar can't be use
    const [simplifying, setSimplifying] = useState(false);
    const dispatch = useDispatch();
    const history = useHistory();
    const [renderHomepage, renderMainToolBar, renderWorkspace, renderMachineMaterialSettings] = useRenderMainToolBar(setSimplifying);
    const modelGroup = useSelector(state => state.printing.modelGroup);
    const isNewUser = useSelector(state => state.printing.isNewUser);
    const thumbnail = useRef();
    const stepRef = useRef();
    useUnsavedTitle(pageHeadType);
    const [showTipModal, setShowTipModal] = useState(!isNewUser);
    const updateControlInput = (event) => {
        const { detail } = event;
        throttle(() => {
            setControlMode(detail.controlValue.mode);
            if (detail.controlValue.mode === ROTATE_MODE && detail.controlValue.axis === null) {
                setControlInputValue(null);
            } else {
                if (detail.controlValue.axis) {
                    setControlAxis(detail.controlValue.axis.split(''));
                }
                setControlInputValue({ ...detail.controlValue.data });
            }
        }, 1000)();
    };
    useEffect(() => {
        dispatch(printingActions.init());
        dispatch(printingActions.checkNewUser());
        logPageView({
            pathname: '/printing'
        });
        window.addEventListener('update-control-input', updateControlInput);
        return () => {
            window.removeEventListener('update-control-input', updateControlInput);
        };
    }, []);
    useEffect(() => {
        const readTip = machineStore.get('readTip', false);
        setShowTipModal(!isNewUser && !readTip);
    }, [isNewUser]);

    useEffect(() => {
        const machine = {
            series: series,
            toolHead: printingToolhead
        };
        const material = {
            leftExtruder: {
                name: leftMaterial?.name,
                color: leftMaterial?.settings?.color?.default_value
            }
        };
        if (printingToolhead === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2) {
            material.rightExtruder = {
                name: rightMaterial?.name,
                color: rightMaterial?.settings?.color?.default_value
            };
        }
        setMachineInfo(machine);
        setMaterialInfo(material);
        renderMainToolBar(machine, material, isConnected);
    }, [series, leftMaterial, rightMaterial, printingToolhead]);

    useEffect(() => {
        renderMainToolBar(machineInfo, materialInfo, isConnected);
    }, [isConnected]);

    useEffect(() => {
        if (location?.state?.shouldShowGuideTours) {
            setEnabledIntro(true);
        } else if (!location?.state?.shouldShowGuideTours && typeof (location?.state?.shouldShowGuideTours) === 'boolean') {
            setEnabledIntro(false);
        } else {
            setEnabledIntro(null);
        }
    }, [location?.state?.shouldShowGuideTours]);

    useEffect(() => {
        if (typeof (enabledIntro) === 'boolean' && !enabledIntro) {
            machineStore.set('guideTours.guideTours3dp', true);
        }
    }, [enabledIntro]);

    async function onDropAccepted(files) {
        // const allFiles = files.map(d => d.name).join();
        // try {
        await dispatch(printingActions.uploadModel(files));
        // } catch (e) {
        //     modal({
        //         title: i18n._('key-Printing/Page-Failed to open model.'),
        //         body: (
        //             <React.Fragment>
        //                 <p>{e.message || e.body.msg}</p>
        //                 <p>{i18n._('key-Printing/ContextMenu-Model source name')}: {allFiles}</p>
        //             </React.Fragment>
        //         )
        //     });
        // }
    }
    function onDropRejected() {
        const title = i18n._('key-Printing/Page-Warning');
        const body = i18n._('key-Printing/Page-Only STL/OBJ files are supported.');
        modal({
            title: title,
            cancelTitle: 'Close',
            body: body
        });
    }

    function renderModalView() {
        return (<PrintingManager />);
    }

    const listActions = {
        onDragStart: () => {
            setIsDraggingWidget(true);
        },
        onDragEnd: () => {
            setIsDraggingWidget(false);
        }
    };
    const renderRightView = () => {
        const widgetProps = { headType: pageHeadType };
        return (
            <div>
                {renderWidgetList('cnc', 'default', widgets, allWidgets, listActions, widgetProps)}
                <PrintingOutputWidget />
            </div>

        );
    };
    // const onClickToUpload = () => {
    //     UniApi.Event.emit('appbar-menu:open-file-in-browser');
    // };
    const handleChange = async (nextIndex) => {
        if (nextIndex === 1) {
            setInitIndex(1);
            const pathConfigForSM2 = {
                path: './UserCase/printing/a150_single/3dp_a150_single.snap3dp',
                name: '3dp_a150_single.snap3dp'
            };
            const pathConfigForOriginal = {
                path: './UserCase/printing/original_single/3dp_original_single.snap3dp',
                name: '3dp_original_single.snap3dp'
            };
            dispatch(projectActions.openProject(isOriginal ? pathConfigForOriginal : pathConfigForSM2, history, true, true));
        } else if (nextIndex === 4) {
            const thumbnailRef = thumbnail.current.getThumbnail();
            await dispatch(printingActions.generateGcode(thumbnailRef, true));
        }
    };

    const handleExit = () => {
        // machineStore.set('guideTours.guideTours3dp', true); // mock   ---> true
        setEnabledIntro(false);
    };
    const handleCloseTipModal = () => {
        setShowTipModal(false);
        machineStore.set('readTip', true);
    };

    return (
        <ProjectLayout
            renderMainToolBar={() => renderMainToolBar(machineInfo, materialInfo, isConnected)}
            renderRightView={renderRightView}
            renderModalView={renderModalView}
        >
            <Dropzone
                multiple
                disabled={isDraggingWidget}
                accept=".stl, .obj, .3mf, .amf"
                dragEnterMsg={i18n._('key-Printing/Page-Drop an STL/OBJ file here.')}
                onDropAccepted={onDropAccepted}
                onDropRejected={onDropRejected}
            >
                <PrintingVisualizer
                    widgetId="printingVisualizer"
                    controlInputValue={controlInputValue}
                    controlAxis={controlAxis}
                    controlMode={controlMode}
                    simplifying={simplifying}
                    setSimplifying={setSimplifying}
                />
                {renderHomepage()}
                {renderWorkspace()}
                {renderMachineMaterialSettings()}
                {enabledIntro && (
                    <Steps
                        enabled={enabledIntro}
                        initialStep={initIndex}
                        onChange={handleChange}
                        ref={stepRef}
                        options={{
                            showBullets: false,
                            keyboardNavigation: false,
                            exitOnOverlayClick: false
                        }}
                        steps={[{
                            element: '.print-tool-bar-open',
                            intro: printIntroStepOne(i18n._('key-Printing/Page-Import an object, or drag an object to Luban.')),
                            position: 'right',
                            title: `${i18n._('key-Printing/Page-Import Object')} (1/6)`,
                            disableInteraction: true,
                            tooltipClass: 'printing-import-intro'
                        }, {
                            element: '.print-intro-three',
                            intro: printIntroStepTwo(i18n._('key-Printing/Page-Place or transform the object using icons, including Move, Scale, Rotate, Mirror, and Manual Support.')),
                            position: 'right',
                            title: `${i18n._('key-Printing/Page-Placement')} (2/6)`,
                            disableInteraction: true,
                            tooltipClass: 'printing-placement-intro'
                        }, {
                            element: '.printing-widget-list-intro',
                            intro: printIntroStepThree(
                                i18n._('key-Printing/Page-Select the material settings and printing settings.'),
                                i18n._('key-Printing/Page-Click'),
                                i18n._('key-Printing/Page-to set and manage detailed parameters.')
                            ),
                            position: 'left',
                            title: `${i18n._('key-Printing/Page-Configure Parameters')} (3/6)`,
                            disableInteraction: true,
                            tooltipClass: 'printing-slice-intro'
                        }, {
                            element: '.print-output-intro',
                            intro: printIntroStepFour(
                                i18n._('key-Printing/Page-Slice and preview the object.'),
                                i18n._('key-Printing/Page-In Preview, you can see printing paths using features, including Line Type and Layer View.'),
                                isOriginal
                            ),
                            position: 'top',
                            title: `${i18n._('key-Printing/Page-Generate G-code and Preview')} (4/6)`,
                            disableInteraction: true,
                            tooltipClass: 'printing-preview-intro'
                        }, {
                            element: '.print-output-intro',
                            intro: printIntroStepFive(i18n._('key-Printing/Page-Export the G-code file to a local device or load it to Workspace. Use Touchscreen or Luban to start printing.')),
                            position: 'top',
                            title: `${i18n._('key-Printing/Page-Export and Print')} (5/6)`,
                            disableInteraction: true,
                            highlightClass: 'printing-export-highlight-part',
                            tooltipClass: 'printing-export-intro'
                        }, {
                            element: '.printing-save-icon',
                            intro: printIntroStepSix(i18n._('key-Printing/Page-Save the project to a local device for reuse.')),
                            position: 'bottom',
                            title: `${i18n._('key-Printing/Page-Save Project')} (6/6)`,
                            disableInteraction: true,
                            tooltipClass: 'printing-save-intro'
                        }]}
                        onExit={handleExit}
                    />
                )}
            </Dropzone>
            <Thumbnail
                ref={thumbnail}
                modelGroup={modelGroup}
            />
            {showTipModal && (
                <Modal
                    onClose={handleCloseTipModal}
                    centered
                    zIndex={100001000}
                >
                    <Modal.Header>
                        {i18n._('key-Printing/Modal-Profile migrated')}
                    </Modal.Header>
                    <Modal.Body>
                        <div className="width-432">
                            <span>
                                {i18n._('key-Printing/Modal-Retraction profile migrated')},
                                <a href="https://support.snapmaker.com/hc/en-us/articles/4438318910231-Retract-Z-Hop-Migrated-from-Printing-Settings-to-Material-Settings" target="_blank" rel="noreferrer" className="link-text">{i18n._('key-Printing/Modal-Click here to learn more')}</a>.
                            </span>
                            <Trans i18nKey="key-Printing/Modal-Backup Tip">
                                For your historical data back up in <span role="presentation" onClick={openFolder} className="link-text">here</span>.
                            </Trans>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            priority="level-two"
                            type="primary"
                            width="96px"
                            onClick={handleCloseTipModal}
                        >
                            {i18n._('key-Printing/Modal-Got it')}
                        </Button>
                    </Modal.Footer>
                </Modal>
            )}
        </ProjectLayout>
    );
}
Printing.propTypes = {
    location: PropTypes.object
};
export default (withRouter(Printing));
