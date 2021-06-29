import React, { useState, useEffect } from 'react';
import { shallowEqual, useSelector, useDispatch } from 'react-redux';
import path from 'path';
// import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
// import Sortable from 'react-sortablejs';
import classNames from 'classnames';
import i18n from '../../lib/i18n';
import Anchor from '../components/Anchor';
import modal from '../../lib/modal';
import LaserVisualizer from '../widgets/LaserVisualizer';
// import Widget from '../widgets/Widget';

import { renderPopup, renderWidgetList, useRenderRecoveryModal, renderModal } from '../utils';
import Dropzone from '../components/Dropzone';
import { actions as editorActions } from '../../flux/editor';
import { actions as laserActions } from '../../flux/laser';
import { actions as projectActions } from '../../flux/project';
import ProjectLayout from '../layouts/ProjectLayout';
import MainToolBar from '../layouts/MainToolBar';
// import WidgetContainer from '../Layouts/Widget';

import { HEAD_LASER, PAGE_EDITOR, PAGE_PROCESS } from '../../constants';


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
import CncLaserObjectList from '../widgets/CncLaserList';
import JobType from '../widgets/JobType';
import PrintingVisualizer from '../widgets/PrintingVisualizer';
import HomePage from './HomePage';
import ToolPathListBox from '../widgets/CncLaserList/ToolPathList';

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
    'cnc-output': CncLaserOutputWidget,
    'cnc-laser-object-list': CncLaserObjectList,
    'toolpath-list': ToolPathListBox
};

const ACCEPT = '.svg, .png, .jpg, .jpeg, .bmp, .dxf';
const pageHeadType = HEAD_LASER;

function useRenderRemoveModelsWarning() {
    const removingModelsWarning = useSelector(state => state?.laser?.removingModelsWarning);
    const emptyToolPaths = useSelector(state => state?.laser?.emptyToolPaths);
    const dispatch = useDispatch();
    const onClose = () => dispatch(editorActions.updateState(HEAD_LASER, {
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
                name: i18n._('Yes'),
                isPrimary: true,
                onClick: () => {
                    dispatch(editorActions.removeSelectedModel(HEAD_LASER));
                    dispatch(editorActions.removeEmptyToolPaths(HEAD_LASER));
                    onClose();
                }
            },
            {
                name: i18n._('Cancel'),
                onClick: () => { onClose(); }
            }
        ]
    });
}
function Laser() {
    const widgets = useSelector(state => state?.widget[pageHeadType]?.default?.widgets, shallowEqual);
    const [isDraggingWidget, setIsDraggingWidget] = useState(false);
    const [showHomePage, setShowHomePage] = useState(false);
    const [showJobType, setShowJobType] = useState(true);
    const coordinateMode = useSelector(state => state[HEAD_LASER]?.coordinateMode, shallowEqual);
    const coordinateSize = useSelector(state => state[HEAD_LASER]?.coordinateSize, shallowEqual);
    const materials = useSelector(state => state[HEAD_LASER]?.materials, shallowEqual);
    const [jobTypeState, setJobTypeState] = useState({
        coordinateMode,
        coordinateSize,
        materials
    });
    const [showCameraCapture, setShowCameraCapture] = useState(false);
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


    const recoveryModal = useRenderRecoveryModal(pageHeadType);
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
                name: i18n._('Save'),
                isPrimary: true,
                onClick: () => {
                    dispatch(editorActions.changeCoordinateMode(HEAD_LASER,
                        jobTypeState.coordinateMode, jobTypeState.coordinateSize));
                    dispatch(editorActions.updateMaterials(HEAD_LASER, jobTypeState.materials));
                    setShowJobType(false);
                }
            },
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
    const setBackgroundModal = showCameraCapture && renderModal({
        title: i18n._('Set Background'),
        renderBody() {
            return (
                <LaserSetBackground />
            );
        },
        actions: [
            {
                name: i18n._('Cancel'),

                onclick: () => { setShowCameraCapture(false); }
            }
        ],
        onClose: () => { setShowCameraCapture(false); }
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
                name: 'Copy',
                action: () => {
                    setShowHomePage(true);
                }
            },
            {
                type: 'separator'
            },
            {
                title: i18n._('Save'),
                type: 'button',
                name: 'Copy',
                action: () => {
                    dispatch(projectActions.save(HEAD_LASER));
                }
            },
            // Todo, add after completed
            // {
            //     title: 'Undo',
            //     type: 'button'
            // },
            // {
            //     title: 'Redo',
            //     type: 'button'
            // }
            {
                title: i18n._('Job'),
                type: 'button',
                name: 'Copy',
                action: () => {
                    setShowJobType(true);
                }
            }
        ];

        const centerItems = [
            {
                name: 'Edit',
                action: () => dispatch(editorActions.bringSelectedModelToFront(HEAD_LASER)),
                title: i18n._('Front')
            },
            {
                name: 'Edit',
                action: () => dispatch(editorActions.sendSelectedModelToBack(HEAD_LASER)),
                title: i18n._('Bottom')
            }
        ];
        const rightItems = [
            {
                name: 'Edit',
                action: () => {
                    setShowCameraCapture(true);
                },
                title: i18n._('Camera')
            }
        ];
        return (
            <MainToolBar
                leftItems={leftItems}
                centerItems={centerItems}
                rightItems={rightItems}
            />
        );
    }
    function renderRightView() {
        const widgetProps = { headType: 'laser' };
        return (
            <div>
                <div
                    style={{
                        display: 'inline-block',
                        width: '50%',
                        border: '1px solid #fafafa',
                        backgroundColor: page === PAGE_EDITOR ? '#b3d4fc' : '#fafafa'
                    }}
                    className={classNames({ 'selected': page === PAGE_EDITOR })}
                >
                    <Anchor
                        onClick={() => dispatch(editorActions.switchToPage(HEAD_LASER, PAGE_EDITOR))}
                    >
                        {i18n._('Edit')}
                    </Anchor>
                </div>
                <div
                    style={{
                        display: 'inline-block',
                        width: '50%',
                        border: '1px solid #fafafa',
                        backgroundColor: page === PAGE_PROCESS ? '#b3d4fc' : '#fafafa'
                    }}
                    className={classNames({ 'selected': page === PAGE_PROCESS })}
                >
                    <Anchor
                        onClick={() => dispatch(editorActions.switchToPage(HEAD_LASER, PAGE_PROCESS))}
                    >
                        {i18n._('Process')}
                    </Anchor>
                </div>
                {renderWidgetList('laser', 'default', widgets, allWidgets, listActions, widgetProps)}
                <CncLaserOutputWidget
                    headType={HEAD_LASER}
                />
            </div>

        );
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
            {recoveryModal}
            {warningRemovingModels}
            {jobTypeModal}
            {setBackgroundModal}
            {renderHomepage()}
        </div>
    );
}
Laser.propTypes = {
    // history: PropTypes.object
    // location: PropTypes.object
};
export default withRouter(Laser);
