import React, { useState, useEffect } from 'react';
import { shallowEqual, useSelector, useDispatch } from 'react-redux';
import path from 'path';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
// import Sortable from 'react-sortablejs';
import classNames from 'classnames';
import isElectron from 'is-electron';
import i18n from '../../lib/i18n';
import Anchor from '../components/Anchor';
import modal from '../../lib/modal';
import LaserVisualizer from '../widgets/LaserVisualizer';
// import Widget from '../widgets/Widget';

import { renderWidgetList, useRenderRecoveryModal } from '../utils';
import Dropzone from '../components/Dropzone';
import { actions as editorActions } from '../../flux/editor';
import { actions as laserActions } from '../../flux/laser';
import { actions as projectActions } from '../../flux/project';
import ProjectLayout from '../Layouts/ProjectLayout';
import MainToolBar from '../Layouts/MainToolBar';

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
import PrintingObjectList from '../widgets/PrintingObjectList';
import JobType from '../widgets/JobType';
import CreateToolPath from '../widgets/CncLaserToolPath';
import PrintingVisualizer from '../widgets/PrintingVisualizer';

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
    '3dp-object-list': PrintingObjectList,
    '3dp-material': PrintingMaterialWidget,
    '3dp-configurations': PrintingConfigurationsWidget,
    '3dp-output': PrintingOutputWidget,
    'laser-params': LaserParamsWidget,
    'laser-output': CncLaserOutputWidget,
    'laser-set-background': LaserSetBackground,
    'laser-test-focus': LaserTestFocusWidget,
    'cnc-path': CNCPathWidget,
    'cnc-output': CncLaserOutputWidget,
    'cnc-laser-object-list': CncLaserObjectList,
    'job-type': JobType,
    'create-toolpath': CreateToolPath
};

const ACCEPT = '.svg, .png, .jpg, .jpeg, .bmp, .dxf';
const pageHeadType = HEAD_LASER;

function Laser({ history }) {
    const widgets = useSelector(state => state?.widget[pageHeadType]?.default?.widgets, shallowEqual);
    const [isDraggingWidget, setIsDraggingWidget] = useState(false);
    const dispatch = useDispatch();
    const page = useSelector(state => state?.laser?.page);

    useEffect(() => {
        dispatch(laserActions.init());
    }, []);

    const recoveryModal = useRenderRecoveryModal(pageHeadType);
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
        const fileInput = React.createRef();
        const leftItems = [
            {
                title: i18n._('Home'),
                type: 'button',
                name: 'Copy',
                action: () => history.push('/')
            },
            {
                type: 'separator'
            },
            {
                title: i18n._('Add'),
                type: 'button',
                name: 'Copy',
                inputInfo: {
                    accept: '.snaplzr',
                    fileInput: fileInput,
                    onChange: async (e) => {
                        const file = e.target.files[0];
                        const recentFile = {
                            name: file.name,
                            path: file.path || ''
                        };
                        try {
                            await dispatch(projectActions.open(file, history));
                            if (isElectron()) {
                                const ipc = window.require('electron').ipcRenderer;
                                ipc.send('add-recent-file', recentFile);
                            }
                            await dispatch(projectActions.updateRecentFile([recentFile], 'update'));
                        } catch (error) {
                            modal({
                                title: i18n._('Failed to upload model'),
                                body: error.message
                            });
                        }
                    }
                },
                action: () => {
                    fileInput.current.value = null;
                    fileInput.current.click();
                }
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
                action: () => {}
            }
        ];
        const centerItems = [
            {
                name: 'Edit',
                action: () => history.push('laser'),
                title: i18n._('Edit')
            }
        ];
        return (
            <MainToolBar
                leftItems={leftItems}
                centerItems={centerItems}
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
        </div>
    );
}
Laser.propTypes = {
    history: PropTypes.object
    // location: PropTypes.object
};
export default withRouter(Laser);
