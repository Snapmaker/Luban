import React, { useState, useEffect } from 'react';

import { shallowEqual, useSelector, useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';

import path from 'path';
import { Trans } from 'react-i18next';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import Dropzone from '../components/Dropzone';
import SvgIcon from '../components/SvgIcon';
import Space from '../components/Space';
import { renderModal, renderPopup, renderWidgetList } from '../utils';
import Tabs from '../components/Tabs';
import Checkbox from '../components/Checkbox';
import { Button } from '../components/Buttons';

import CNCVisualizer from '../widgets/CNCVisualizer';
import ProjectLayout from '../layouts/ProjectLayout';
import MainToolBar from '../layouts/MainToolBar';

import { actions as projectActions } from '../../flux/project';
import { actions as cncActions } from '../../flux/cnc';
import { actions as editorActions } from '../../flux/editor';

import { actions as machineActions } from '../../flux/machine';

import {
    PROCESS_MODE_GREYSCALE,
    PROCESS_MODE_MESH,
    PROCESS_MODE_VECTOR,
    PAGE_EDITOR,
    PAGE_PROCESS,
    HEAD_CNC
} from '../../constants';

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
import JobType from '../widgets/JobType';
import ToolPathListBox from '../widgets/CncLaserList/ToolPathList';
import PrintingVisualizer from '../widgets/PrintingVisualizer';
import HomePage from './HomePage';
import Anchor from '../components/Anchor';
import Workspace from './Workspace';

const allWidgets = {
    'control': ControlWidget,
    // 'axesPanel': DevelopAxesWidget,
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
    '3dp-output': PrintingOutputWidget,
    'laser-params': LaserParamsWidget,
    // 'laser-output': CncLaserOutputWidget,
    'laser-set-background': LaserSetBackground,
    'laser-test-focus': LaserTestFocusWidget,
    'cnc-path': CNCPathWidget,
    // 'cnc-output': CncLaserOutputWidget,
    'toolpath-list': ToolPathListBox
};


const ACCEPT = '.svg, .png, .jpg, .jpeg, .bmp, .dxf, .stl';
const pageHeadType = HEAD_CNC;
function useRenderWarning() {
    const [showWarning, setShowWarning] = useState(false);
    const dispatch = useDispatch();

    const onClose = () => setShowWarning(false);

    function onChangeShouldShowWarning(value) {
        dispatch(machineActions.setShouldShowCncWarning(value));
    }

    return showWarning && renderModal({
        onClose,
        renderBody: () => (
            <div style={{ width: '432px' }}>
                <SvgIcon
                    color="#FFA940"
                    type="static"
                    className="display-block width-72 margin-auto"
                    name="WarningTipsWarning"
                    size="72"
                />
                <div className="align-c font-weight-bold margin-bottom-16">
                    {i18n._('Warning')}
                </div>
                <div>
                    <Trans i18nKey="key_CNC_loading_warning">
                                This is an alpha feature that helps you get started with CNC Carving. Make sure you
                        <Space width={4} />
                        <a
                            style={{ color: '#28a7e1' }}
                            href="https://manual.snapmaker.com/cnc_carving/read_this_first_-_safety_information.html"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                                    Read This First - Safety Information
                        </a>
                        <Space width={4} />
                                before proceeding.
                    </Trans>
                </div>
            </div>
        ),
        renderFooter: () => (
            <div className="sm-flex justify-space-between">
                <div className="display-inline height-32">
                    <Checkbox
                        id="footer-input"
                        defaultChecked={false}
                        onChange={onChangeShouldShowWarning}
                    />
                    <span className="margin-left-4">{i18n._('Don\'t show again')}</span>
                </div>
                <Button
                    type="default"
                    width="96px"
                    priority="level-two"
                    onClick={onClose}
                >
                    {i18n._('Cancel')}
                </Button>
            </div>
        )
    });
}
function useRenderRemoveModelsWarning() {
    const removingModelsWarning = useSelector(state => state?.cnc?.removingModelsWarning);
    const emptyToolPaths = useSelector(state => state?.cnc?.emptyToolPaths);
    const dispatch = useDispatch();
    const onClose = () => dispatch(editorActions.updateState(HEAD_CNC, {
        removingModelsWarning: false
    }));
    return removingModelsWarning && renderModal({
        onClose,
        renderBody: () => (
            <div>
                <div>{i18n._('Remove all empty toolPath(s)?')}</div>
                {emptyToolPaths.map((item) => {
                    return (<div key={item.name}>{item.name}</div>);
                })}
            </div>
        ),
        actions: [
            {
                name: i18n._('Cancel'),
                onClick: () => { onClose(); }
            },
            {
                name: i18n._('Yes'),
                isPrimary: true,
                onClick: () => {
                    dispatch(editorActions.removeSelectedModel(HEAD_CNC));
                    dispatch(editorActions.removeEmptyToolPaths(HEAD_CNC));
                    onClose();
                }
            }
        ]
    });
}
function Cnc({ location }) {
    const widgets = useSelector(state => state?.widget[pageHeadType]?.default?.widgets, shallowEqual);
    const [isDraggingWidget, setIsDraggingWidget] = useState(false);
    const [showHomePage, setShowHomePage] = useState(false);
    const [showWorkspace, setShowWorkspace] = useState(false);
    const [showJobType, setShowJobType] = useState(true);
    const coordinateMode = useSelector(state => state[HEAD_CNC]?.coordinateMode, shallowEqual);
    const coordinateSize = useSelector(state => state[HEAD_CNC]?.coordinateSize, shallowEqual);
    const materials = useSelector(state => state[HEAD_CNC]?.materials, shallowEqual);
    const canRedo = useSelector(state => state[HEAD_CNC]?.history?.canRedo, shallowEqual);
    const canUndo = useSelector(state => state[HEAD_CNC]?.history?.canUndo, shallowEqual);
    const [jobTypeState, setJobTypeState] = useState({
        coordinateMode,
        coordinateSize,
        materials
    });
    const dispatch = useDispatch();
    const page = useSelector(state => state?.cnc.page);

    useEffect(() => {
        dispatch(cncActions.init());
    }, []);

    useEffect(() => {
        setJobTypeState({
            coordinateMode,
            coordinateSize,
            materials
        });
    }, [coordinateMode, coordinateSize, materials]);

    useEffect(() => {
        if (location?.state?.shouldShowJobType) {
            setShowJobType(true);
        }
    }, [location?.state?.shouldShowJobType]);

    const renderHomepage = () => {
        const onClose = () => setShowHomePage(false);
        return showHomePage && renderPopup({
            onClose,
            component: HomePage
        });
    };

    const jobTypeModal = (showJobType) && renderModal({
        title: i18n._('Job Type'),
        renderBody() {
            return (
                <JobType
                    isWidget={false}
                    headType={HEAD_CNC}
                    jobTypeState={jobTypeState}
                    setJobTypeState={setJobTypeState}
                />
            );
        },
        actions: [
            {
                name: i18n._('Cancel'),
                onClick: () => {
                    setJobTypeState({
                        coordinateMode,
                        coordinateSize,
                        materials
                    });
                    setShowJobType(false);
                }
            },
            {
                name: i18n._('Save'),
                isPrimary: true,
                onClick: () => {
                    dispatch(editorActions.changeCoordinateMode(HEAD_CNC,
                        jobTypeState.coordinateMode, jobTypeState.coordinateSize));
                    dispatch(editorActions.updateMaterials(HEAD_CNC, jobTypeState.materials));
                    setShowJobType(false);
                }
            }
        ],
        onClose: () => {
            setJobTypeState({
                coordinateMode,
                coordinateSize,
                materials
            });
            setShowJobType(false);
        }
    });
    const warningModal = useRenderWarning();
    const removeModelsWarningModal = useRenderRemoveModelsWarning();
    const listActions = {
        onDragStart: () => {
            setIsDraggingWidget(true);
        },
        onDragEnd: () => {
            setIsDraggingWidget(false);
        }
    };

    const actions = {
        onDropAccepted: (file) => {
            const extname = path.extname(file.name).toLowerCase();
            let uploadMode;
            if (extname.toLowerCase() === '.svg') {
                uploadMode = PROCESS_MODE_VECTOR;
            } else if (extname.toLowerCase() === '.dxf') {
                uploadMode = PROCESS_MODE_VECTOR;
            } else if (extname.toLowerCase() === '.stl') {
                uploadMode = PROCESS_MODE_MESH;
            } else {
                uploadMode = PROCESS_MODE_GREYSCALE;
            }
            dispatch(editorActions.uploadImage('cnc', file, uploadMode, () => {
                modal({
                    title: i18n._('Parse Error'),
                    body: i18n._('Failed to parse image file {{filename}}.', { filename: file.name })
                });
            }));
        },
        onDropRejected: () => {
            modal({
                title: i18n._('Warning'),
                cancelTitle: 'Close',
                body: i18n._('Only {{accept}} files are supported.', { accept: ACCEPT })
            });
        }
    };

    function renderMainToolBar() {
        // const fileInput = React.createRef();
        const leftItems = [
            {
                title: i18n._('Home'),
                type: 'button',
                name: 'MainToolbarHome',
                action: () => {
                    setShowHomePage(true);
                    window.scrollTo(0, 0);
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
            // {
            //     title: i18n._('Open'),
            //     type: 'button',
            //     name: 'Copy',
            //     inputInfo: {
            //         accept: '.snapcnc',
            //         fileInput: fileInput,
            //         onChange: async (e) => {
            //             const file = e.target.files[0];
            //             const recentFile = {
            //                 name: file.name,
            //                 path: file.path || ''
            //             };
            //             try {
            //                 await dispatch(projectActions.openProject(file, history));
            //                 // Todo: Add to recent file, but not use isElectron()
            //                 // if (isElectron()) {
            //                 //     const ipc = window.require('electron').ipcRenderer;
            //                 //     ipc.send('add-recent-file', recentFile);
            //                 // }
            //                 await dispatch(projectActions.updateRecentFile([recentFile], 'update'));
            //             } catch (error) {
            //                 modal({
            //                     title: i18n._('Failed to upload model'),
            //                     body: error.message
            //                 });
            //             }
            //         }
            //     },
            //     action: () => {
            //         fileInput.current.value = null;
            //         fileInput.current.click();
            //     }
            // },
            {
                title: i18n._('Save'),
                type: 'button',
                name: 'MainToolbarSave',
                action: () => {
                    dispatch(projectActions.save(HEAD_CNC));
                }
            },
            {
                title: i18n._('Undo'),
                disabled: !canUndo,
                type: 'button',
                name: 'MainToolbarUndo',
                action: () => {
                    dispatch(editorActions.undo(HEAD_CNC));
                }
            },
            {
                title: i18n._('Redo'),
                disabled: !canRedo,
                type: 'button',
                name: 'MainToolbarRedo',
                action: () => {
                    dispatch(editorActions.redo(HEAD_CNC));
                }
            },
            {
                title: i18n._('Job Setup'),
                type: 'button',
                name: 'MainToolbarJobSetup',
                action: () => {
                    setShowJobType(true);
                }
            },
            {
                type: 'separator'
            },
            {
                type: 'render',
                customRender: function () {
                    return (
                        <Anchor
                            onClick={() => dispatch(editorActions.bringSelectedModelToFront(HEAD_CNC))}
                            className="width-64 display-inline align-c padding-vertical-2 padding-horizontal-2 font-size-0"
                        >
                            <i
                                style={{
                                    backgroundImage: `url(${require('../../resources/images/laser-image/Set-top-normal.svg')})`
                                }}
                                className="width-24 height-24 display-inline "
                            />
                            <div className="font-size-base">
                                {i18n._('Top')}
                            </div>
                        </Anchor>
                    );
                }
            },
            {
                type: 'render',
                customRender: function () {
                    return (
                        <Anchor
                            onClick={() => dispatch(editorActions.sendSelectedModelToBack(HEAD_CNC))}
                            className="width-64 display-inline align-c padding-vertical-2 padding-horizontal-2 font-size-0"
                        >
                            <i
                                style={{
                                    backgroundImage: `url(${require('../../resources/images/laser-image/Set-bottom-normal.svg')})`
                                }}
                                className="width-24 height-24 display-inline "
                            />
                            <div className="font-size-base">
                                {i18n._('Bottom')}
                            </div>
                        </Anchor>
                    );
                }
            }
        ];
        const centerItems = [
            // {
            //     name: 'Edit',
            //     action: () => dispatch(editorActions.bringSelectedModelToFront(HEAD_CNC)),
            //     title: i18n._('Front')
            // },
            // {
            //     name: 'Edit',
            //     action: () => dispatch(editorActions.sendSelectedModelToBack(HEAD_CNC)),
            //     title: i18n._('Bottom')
            // }
        ];
        return (
            <MainToolBar
                leftItems={leftItems}
                centerItems={centerItems}
            />
        );
    }
    function renderRightView() {
        const widgetProps = { headType: 'cnc' };
        return (
            <div>
                <Tabs
                    options={[
                        {
                            tab: i18n._('Edit'),
                            key: PAGE_EDITOR
                        },
                        {
                            tab: i18n._('Process'),
                            key: PAGE_PROCESS
                        }
                    ]}
                    activeKey={page}
                    onChange={(key) => {
                        dispatch(editorActions.switchToPage(HEAD_CNC, key));
                    }}
                />
                {renderWidgetList('cnc', 'default', widgets, allWidgets, listActions, widgetProps)}
                <CncLaserOutputWidget
                    headType={HEAD_CNC}
                />
            </div>
        );
    }
    function renderWorkspace() {
        const onClose = () => setShowWorkspace(false);
        return showWorkspace && renderPopup({
            onClose,
            component: Workspace
        });
    }

    return (
        <div>
            <ProjectLayout
                renderMainToolBar={renderMainToolBar}
                renderRightView={renderRightView}
            >
                <Dropzone
                    disabled={isDraggingWidget}
                    accept={ACCEPT}
                    dragEnterMsg={i18n._('Drop an image file here.')}
                    onDropAccepted={actions.onDropAccepted}
                    onDropRejected={actions.onDropRejected}
                >
                    <CNCVisualizer />
                </Dropzone>
            </ProjectLayout>
            {warningModal}
            {removeModelsWarningModal}
            {jobTypeModal}
            {renderHomepage()}
            {renderWorkspace()}
        </div>
    );
}
Cnc.propTypes = {
    // ...withRouter,
    // shouldShowJobType: PropTypes.bool,
    location: PropTypes.object
};
export default withRouter(Cnc);
