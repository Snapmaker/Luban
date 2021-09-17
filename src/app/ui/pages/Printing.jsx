import React, { useState, useEffect, useRef } from 'react';
import { shallowEqual, useSelector, useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { useHistory, withRouter } from 'react-router-dom';
// import { Steps } from 'intro.js-react';
import 'intro.js/introjs.css';
import PrintingVisualizer from '../widgets/PrintingVisualizer';
// import PrintingOutput from '../widgets/PrintingOutput';
import PrintingManager from '../views/PrintingManager';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import Dropzone from '../components/Dropzone';
import { actions as printingActions } from '../../flux/printing';
import { actions as projectActions } from '../../flux/project';
import ProjectLayout from '../layouts/ProjectLayout';
import MainToolBar from '../layouts/MainToolBar';
import { HEAD_PRINTING } from '../../constants';
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
function useRenderMainToolBar() {
    const unSaved = useSelector(state => state?.project[pageHeadType]?.unSaved, shallowEqual);
    const hasModel = useSelector(state => state?.printing?.hasModel, shallowEqual);
    const inProgress = useSelector(state => state?.printing?.inProgress, shallowEqual);
    const enableShortcut = useSelector(state => state?.printing?.enableShortcut, shallowEqual);
    const canRedo = useSelector(state => state?.printing?.history?.canRedo, shallowEqual);
    const canUndo = useSelector(state => state?.printing?.history?.canUndo, shallowEqual);
    const [showHomePage, setShowHomePage] = useState(false);
    const [showWorkspace, setShowWorkspace] = useState(false);
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
            component: HomePage
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
            component: Workspace
        });
    }
    function renderMainToolBar() {
        // const fileInput = React.createRef();
        const leftItems = [
            {
                title: i18n._('Home'),
                disabled: inProgress,
                type: 'button',
                name: 'MainToolbarHome',
                action: () => {
                    setShowHomePage(true);
                }
            },
            {
                title: i18n._('Workspace'),
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
                title: i18n._('Save'),
                disabled: !unSaved || !hasModel || !enableShortcut,
                type: 'button',
                name: 'MainToolbarSave',
                iconClassName: 'printing-save-icon',
                action: () => {
                    dispatch(projectActions.save(HEAD_PRINTING));
                }
            },
            {
                title: i18n._('Undo'),
                disabled: !canUndo || !enableShortcut,
                type: 'button',
                name: 'MainToolbarUndo',
                action: () => {
                    dispatch(printingActions.undo());
                }
            },
            {
                title: i18n._('Redo'),
                disabled: !canRedo || !enableShortcut,
                type: 'button',
                name: 'MainToolbarRedo',
                action: () => {
                    dispatch(printingActions.redo());
                }
            }
        ];
        return (
            <MainToolBar
                leftItems={leftItems}
            />
        );
    }
    return [renderHomepage, renderMainToolBar, renderWorkspace];
}

function Printing({ location }) {
    const widgets = useSelector(state => state?.widget[pageHeadType].default.widgets, shallowEqual);
    const [isDraggingWidget, setIsDraggingWidget] = useState(false);
    const [enabledIntro, setEnabledIntro] = useState(null);
    const [initIndex, setInitIndex] = useState(0);
    const dispatch = useDispatch();
    const history = useHistory();
    const [renderHomepage, renderMainToolBar, renderWorkspace] = useRenderMainToolBar();
    const modelGroup = useSelector(state => state.printing.modelGroup);
    const thumbnail = useRef();
    const stepRef = useRef();
    useUnsavedTitle(pageHeadType);

    useEffect(() => {
        dispatch(printingActions.init());
        logPageView({
            pathname: '/printing'
        });
    }, []);
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

    async function onDropAccepted(file) {
        try {
            await dispatch(printingActions.uploadModel(file));
        } catch (e) {
            modal({
                title: i18n._('Failed to open model.'),
                body: e.message
            });
        }
    }
    function onDropRejected() {
        const title = i18n._('Warning');
        const body = i18n._('Only STL/OBJ files are supported.');
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
            const pathConfig = {
                path: './UserCase/A150/A150_3DP.snap3dp',
                name: 'A150_3DP.snap3dp'
            };
            dispatch(projectActions.openProject(pathConfig, history, true));
        } else if (nextIndex === 4) {
            const thumbnailRef = thumbnail.current.getThumbnail();
            await dispatch(printingActions.generateGcode(thumbnailRef, true));
        }
    };

    const handleExit = () => {
        // machineStore.set('guideTours.guideTours3dp', true); // mock   ---> true
        setEnabledIntro(false);
    };

    return (
        <ProjectLayout
            renderMainToolBar={renderMainToolBar}
            renderRightView={renderRightView}
            renderModalView={renderModalView}
        >
            <Dropzone
                disabled={isDraggingWidget}
                accept=".stl, .obj"
                dragEnterMsg={i18n._('Drop an STL/OBJ file here.')}
                onDropAccepted={onDropAccepted}
                onDropRejected={onDropRejected}
            >
                <PrintingVisualizer widgetId="printingVisualizer" />
                {renderHomepage()}
                {renderWorkspace()}
                <Steps
                    enabled={enabledIntro}
                    initialStep={initIndex}
                    onChange={handleChange}
                    ref={stepRef}
                    // onBeforeChange={handleBeforeChange}
                    options={{
                        showBullets: false,
                        keyboardNavigation: false,
                        exitOnOverlayClick: false
                    }}
                    steps={[{
                        element: '.print-tool-bar-open',
                        intro: printIntroStepOne(i18n._('Import an object, or drag an object to Luban.')),
                        position: 'right',
                        title: `${i18n._('Import Object')} (1/6)`,
                        disableInteraction: true,
                        tooltipClass: 'printing-import-intro'
                    }, {
                        element: '.print-intro-three',
                        intro: printIntroStepTwo(i18n._('Place or transform the object using icons, including Move, Scale, Rotate, Mirror, and Manual Support.')),
                        position: 'right',
                        title: `${i18n._('Placement')} (2/6)`,
                        disableInteraction: true,
                        tooltipClass: 'printing-placement-intro'
                    }, {
                        element: '.threedp-widget-list-intro',
                        intro: printIntroStepThree(
                            i18n._('Select the material settings and printing settings.'),
                            i18n._('Click'),
                            i18n._('to set and manage detailed parameters.')
                        ),
                        position: 'left',
                        title: `${i18n._('Configure Parameters')} (3/6)`,
                        disableInteraction: true,
                        tooltipClass: 'printing-slice-intro'
                    }, {
                        element: '.print-output-intro',
                        intro: printIntroStepFour(
                            i18n._('Slice and preview the object.'),
                            i18n._('In Preview, you can see printing paths using features, including Line Type and Layer View.')
                        ),
                        position: 'top',
                        title: `${i18n._('Generate G-code and Preview')} (4/6)`,
                        disableInteraction: true,
                        tooltipClass: 'printing-preview-intro'
                    }, {
                        element: '.print-output-intro',
                        intro: printIntroStepFive(i18n._('Export the G-code file to a local device or load it to Workspace. Use Touchscreen or Luban to start printing.')),
                        position: 'top',
                        title: `${i18n._('Export and Print')} (5/6)`,
                        disableInteraction: true,
                        highlightClass: 'printing-export-highlight-part',
                        tooltipClass: 'printing-export-intro'
                    }, {
                        element: '.printing-save-icon',
                        intro: printIntroStepSix(i18n._('Save the project to a local device for reuse.')),
                        position: 'bottom',
                        title: `${i18n._('Save Project')} (6/6)`,
                        disableInteraction: true,
                        tooltipClass: 'printing-save-intro'
                    }]}
                    onExit={handleExit}
                />
            </Dropzone>
            <Thumbnail
                ref={thumbnail}
                modelGroup={modelGroup}
            />
        </ProjectLayout>
    );
}
Printing.propTypes = {
    location: PropTypes.object
};
export default (withRouter(Printing));
