import React, { useState, useEffect } from 'react';
import { shallowEqual, useSelector, useDispatch } from 'react-redux';
// import Sortable from 'react-sortablejs';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
// import Widget from '../widgets/Widget';
import PrintingVisualizer from '../widgets/PrintingVisualizer';
import PrintingManager from '../views/PrintingManager';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import Dropzone from '../components/Dropzone';
import { actions as printingActions } from '../../flux/printing';
import { actions as projectActions } from '../../flux/project';
import ProjectLayout from '../Layouts/ProjectLayout';
import MainToolBar from '../Layouts/MainToolBar';
import { HEAD_3DP } from '../../constants';
import { renderWidgetList, renderRecoveryModal, useGetRecoveringProject } from '../utils';

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
    // 'laser-output': CncLaserOutputWidget,
    'laser-set-background': LaserSetBackground,
    'laser-test-focus': LaserTestFocusWidget,
    'cnc-path': CNCPathWidget,
    'cnc-output': CncLaserOutputWidget,
    'cnc-laser-object-list': CncLaserObjectList,
    'job-type': JobType,
    'create-toolpath': CreateToolPath
};

const pageHeadType = HEAD_3DP;

function Printing({ history, location }) {
    const widgets = useSelector(state => state?.widget[pageHeadType].default.widgets, shallowEqual);
    const [isDraggingWidget, setIsDraggingWidget] = useState(false);
    const dispatch = useDispatch();

    const [recoveringProject, setRecoveringProject] = useGetRecoveringProject(pageHeadType);

    useEffect(() => {
        return async () => {
            dispatch(projectActions.save(pageHeadType));
        };
    }, [location.pathname]);
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
            body: body
        });
    }

    function renderMainToolBar() {
        const leftItems = [
            {
                title: 'Home',
                type: 'button',
                action: () => history.push('/')
            },
            {
                type: 'separator'
            }
        ];
        const centerItems = [
            {
                type: 'button',
                name: 'Edit',
                title: 'Edit',
                action: () => history.push('cnc')
            }
        ];
        return (
            <MainToolBar
                leftItems={leftItems}
                centerItems={centerItems}
            />
        );
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
            </div>

        );
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
            </Dropzone>
            {recoveringProject && renderRecoveryModal(pageHeadType, () => { setRecoveringProject(false); })}
        </ProjectLayout>
    );
}
Printing.propTypes = {
    history: PropTypes.object,
    location: PropTypes.object
};

export default (withRouter(Printing));
