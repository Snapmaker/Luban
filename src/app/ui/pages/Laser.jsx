import React, { useState, useEffect } from 'react';
import { shallowEqual, useSelector, useDispatch } from 'react-redux';
import path from 'path';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
// import classNames from 'classnames';
import i18n from '../../lib/i18n';
// import Anchor from '../components/Anchor';
import Dropdown from '../components/Dropdown';
import Menu from '../components/Menu';
import SvgIcon from '../components/SvgIcon';
import modal from '../../lib/modal';
import LaserVisualizer from '../widgets/LaserVisualizer';
import Tabs from '../components/Tabs';

import { renderPopup, renderWidgetList, renderModal } from '../utils';
import Dropzone from '../components/Dropzone';
import { actions as editorActions } from '../../flux/editor';
import { actions as laserActions } from '../../flux/laser';
import { actions as projectActions } from '../../flux/project';
import ProjectLayout from '../layouts/ProjectLayout';
import MainToolBar from '../layouts/MainToolBar';
// import WidgetContainer from '../Layouts/Widget';

import { HEAD_LASER, PAGE_EDITOR, PAGE_PROCESS, MACHINE_SERIES } from '../../constants';


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
import LaserCameraAidBackground from '../widgets/LaserCameraAidBackground';
import LaserTestFocusWidget from '../widgets/LaserTestFocus';
import CNCPathWidget from '../widgets/CNCPath';
import CncLaserOutputWidget from '../widgets/CncLaserOutput';

import PrintingMaterialWidget from '../widgets/PrintingMaterial';
import PrintingConfigurationsWidget from '../widgets/PrintingConfigurations';
import PrintingOutputWidget from '../widgets/PrintingOutput';
import WifiTransport from '../widgets/WifiTransport';
import EnclosureWidget from '../widgets/Enclosure';
import CncLaserObjectList from '../widgets/CncLaserList';
import JobType from '../widgets/JobType';
import PrintingVisualizer from '../widgets/PrintingVisualizer';
import HomePage from './HomePage';
import ToolPathListBox from '../widgets/CncLaserList/ToolPathList';
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
    'laser-test-focus': LaserTestFocusWidget,
    'cnc-path': CNCPathWidget,
    'cnc-output': CncLaserOutputWidget,
    'cnc-laser-object-list': CncLaserObjectList,
    'toolpath-list': ToolPathListBox
};

const ACCEPT = '.svg, .png, .jpg, .jpeg, .bmp, .dxf';
const pageHeadType = HEAD_LASER;


function useRenderMainToolBar(setShowHomePage, setShowJobType, setShowWorkspace) {
    // (!workPosition.isFourAxis && (connectionType === CONNECTION_TYPE_WIFI && isConnected && !hasBackground))
    const isConnected = useSelector(state => state?.machine?.isConnected, shallowEqual);
    const series = useSelector(state => state?.machine?.series, shallowEqual);
    const canRedo = useSelector(state => state[HEAD_LASER]?.history?.canRedo, shallowEqual);
    const canUndo = useSelector(state => state[HEAD_LASER]?.history?.canUndo, shallowEqual);
    const [showCameraCapture, setShowCameraCapture] = useState(false);
    const dispatch = useDispatch();
    const menu = (
        <Menu style={{ marginTop: '8px' }}>
            <Menu.Item
                onClick={() => setShowCameraCapture(true)}
                disabled={series === MACHINE_SERIES.ORIGINAL?.value ? false : !isConnected}
            >
                <div className="align-l width-168">
                    <SvgIcon
                        type="static"
                        name="MainToolbarAddBackground"
                    />
                    <span
                        className="margin-left-4"
                    >
                        {i18n._('Add Background')}
                    </span>

                </div>
            </Menu.Item>
            <Menu.Item
                onClick={() => dispatch(laserActions.removeBackgroundImage())}
            >
                <div className="align-l width-168">
                    <SvgIcon
                        type="static"
                        name="MainToolbarRemoverBackground"
                    />
                    <span
                        className="margin-left-4"
                    >
                        {i18n._('Remove Background')}
                    </span>
                </div>
            </Menu.Item>
        </Menu>
    );
    const leftItems = [
        {
            title: i18n._('Home'),
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
            type: 'button',
            name: 'MainToolbarSave',
            action: () => {
                dispatch(projectActions.save(HEAD_LASER));
            }
        },
        {
            title: i18n._('Undo'),
            disabled: !canUndo,
            type: 'button',
            name: 'MainToolbarUndo',
            action: () => {
                dispatch(editorActions.undo(HEAD_LASER));
            }
        },
        {
            title: i18n._('Redo'),
            disabled: !canRedo,
            type: 'button',
            name: 'MainToolbarRedo',
            action: () => {
                dispatch(editorActions.redo(HEAD_LASER));
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
            title: i18n._('Top'),
            type: 'button',
            name: 'MainToolbarTop',
            action: () => {
                dispatch(editorActions.bringSelectedModelToFront(HEAD_LASER));
            }
        },
        {
            title: i18n._('Bottom'),
            type: 'button',
            name: 'MainToolbarBottom',
            action: () => {
                dispatch(editorActions.sendSelectedModelToBack(HEAD_LASER));
            }
        },
        {
            type: 'separator'
        },
        {
            // MainToolbarCameraCapture
            type: 'render',
            customRender: function () {
                return (
                    <Dropdown
                        className="display-inline align-c padding-top-4 padding-horizontal-2"
                        overlay={menu}
                    >
                        <div
                            className="display-inline font-size-0 v-align-t"
                        >
                            <SvgIcon
                                name="MainToolbarCameraCapture"
                            >
                                <div className="font-size-base color-black-3">
                                    {i18n._('Camera Capture')}
                                    <SvgIcon
                                        type="static"
                                        name="DropdownLine"
                                    />
                                </div>
                            </SvgIcon>
                        </div>
                    </Dropdown>
                );
            }
        }
    ];

    const setBackgroundModal = showCameraCapture && renderModal({
        renderBody() {
            return (
                <div>
                    {series === MACHINE_SERIES.ORIGINAL?.value && (
                        <LaserSetBackground
                            hideModal={() => {
                                setShowCameraCapture(false);
                            }}
                        />
                    )}
                    {series !== MACHINE_SERIES.ORIGINAL?.value && (
                        <LaserCameraAidBackground
                            hideModal={() => {
                                setShowCameraCapture(false);
                            }}
                        />
                    )}
                </div>
            );
        },
        actions: [],
        onClose: () => { setShowCameraCapture(false); }
    });

    return {
        setBackgroundModal,
        renderMainToolBar: () => {
            return (
                <MainToolBar
                    leftItems={leftItems}
                />
            );
        }
    };
}

function useRenderRemoveModelsWarning() {
    const removingModelsWarning = useSelector(state => state?.laser?.removingModelsWarning);
    const emptyToolPaths = useSelector(state => state?.laser?.emptyToolPaths);
    const dispatch = useDispatch();
    const onClose = () => dispatch(editorActions.updateState(HEAD_LASER, {
        removingModelsWarning: false
    }));
    const returnModal = renderModal({
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
                    dispatch(editorActions.removeSelectedModel(HEAD_LASER));
                    dispatch(editorActions.removeEmptyToolPaths(HEAD_LASER));
                    onClose();
                }
            }
        ]
    });
    if (removingModelsWarning) {
        return returnModal;
    } else {
        return null;
    }
}
function Laser({ location }) {
    const widgets = useSelector(state => state?.widget[pageHeadType]?.default?.widgets, shallowEqual);
    const [isDraggingWidget, setIsDraggingWidget] = useState(false);
    const [showHomePage, setShowHomePage] = useState(false);
    const [showWorkspace, setShowWorkspace] = useState(false);
    const [showJobType, setShowJobType] = useState(true);
    const coordinateMode = useSelector(state => state[HEAD_LASER]?.coordinateMode, shallowEqual);
    const coordinateSize = useSelector(state => state[HEAD_LASER]?.coordinateSize, shallowEqual);
    const materials = useSelector(state => state[HEAD_LASER]?.materials, shallowEqual);
    const [jobTypeState, setJobTypeState] = useState({
        coordinateMode,
        coordinateSize,
        materials
    });
    const dispatch = useDispatch();
    const page = useSelector(state => state?.laser?.page);
    useEffect(() => {
        dispatch(laserActions.init());
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

    const { setBackgroundModal,
        renderMainToolBar } = useRenderMainToolBar(setShowHomePage, setShowJobType, setShowWorkspace);
    const renderHomepage = () => {
        const onClose = () => setShowHomePage(false);
        return showHomePage && renderPopup({
            onClose,
            component: HomePage
        });
    };
    const jobTypeModal = showJobType && renderModal({
        title: i18n._('Job Type'),
        renderBody() {
            return (
                <JobType
                    isWidget={false}
                    headType={HEAD_LASER}
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
                    dispatch(editorActions.changeCoordinateMode(HEAD_LASER,
                        jobTypeState.coordinateMode, jobTypeState.coordinateSize));
                    dispatch(editorActions.updateMaterials(HEAD_LASER, jobTypeState.materials));
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
    const warningRemovingModels = useRenderRemoveModelsWarning();
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
            let mode = 'bw';
            if (path.extname(file.name).toLowerCase() === '.svg' || path.extname(file.name).toLowerCase() === '.dxf') {
                mode = 'vector';
            }
            dispatch(editorActions.uploadImage('laser', file, mode, () => {
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


    function renderRightView() {
        const widgetProps = { headType: 'laser' };
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
                        dispatch(editorActions.switchToPage(HEAD_LASER, key));
                    }}
                />
                {renderWidgetList('laser', 'default', widgets, allWidgets, listActions, widgetProps)}
                <CncLaserOutputWidget
                    headType={HEAD_LASER}
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
                    <LaserVisualizer
                        widgetId="laserVisualizer"
                    />
                </Dropzone>
            </ProjectLayout>
            {warningRemovingModels}
            {jobTypeModal}
            {setBackgroundModal}
            {renderHomepage()}
            {renderWorkspace()}
        </div>
    );
}
Laser.propTypes = {
    // history: PropTypes.object
    location: PropTypes.object
};
export default withRouter(Laser);
