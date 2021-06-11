import React, { Component } from 'react';
import path from 'path';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
// import Sortable from 'react-sortablejs';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import LaserVisualizer from '../widgets/LaserVisualizer';
// import Widget from '../widgets/Widget';

import { renderWidgetList } from '../utils';
import Dropzone from '../components/Dropzone';
import { actions as editorActions } from '../../flux/editor';
import { actions as widgetActions } from '../../flux/widget';
// import styles from './styles.styl';
import ProjectLayout from '../Layouts/ProjectLayout';
import MainToolBar from '../Layouts/MainToolBar';

import { PAGE_EDITOR, PAGE_PROCESS } from '../../constants';


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

class Laser extends Component {
    static propTypes = {
        ...withRouter.propTypes,
        widgets: PropTypes.array.isRequired,
        style: PropTypes.object,
        uploadImage: PropTypes.func.isRequired,
        switchToPage: PropTypes.func.isRequired,
        updateTabContainer: PropTypes.func.isRequired
    };

    state = {
        isDraggingWidget: false
    };

    actions = {
        // todo: show UI then select process mode
        onDropAccepted: (file) => {
            let mode = 'bw';
            if (path.extname(file.name).toLowerCase() === '.svg' || path.extname(file.name).toLowerCase() === '.dxf') {
                mode = 'vector';
            }
            this.props.uploadImage(file, mode, () => {
                modal({
                    title: i18n._('Parse Error'),
                    body: i18n._('Failed to parse image file {{filename}}.', { filename: file.name })
                });
            });
        },
        onDropRejected: () => {
            modal({
                title: i18n._('Warning'),
                body: i18n._('Only {{accept}} files are supported.', { accept: ACCEPT })
            });
        },
        onDragWidgetStart: () => {
            this.setState({ isDraggingWidget: true });
        },
        onDragWidgetEnd: () => {
            this.setState({ isDraggingWidget: false });
        },
        onChangeWidgetOrder: (widgets) => {
            this.props.updateTabContainer({ widgets });
        }
    };

    renderMainToolBar = () => {
        const leftItems = [
            {
                title: 'Home',
                action: () => this.props.history.push('/')
            },
            {
                type: 'separator'
            }
        ];
        const centerItems = [
            {
                title: 'Edit',
                action: () => this.props.history.push('cnc')
            }
        ];
        return (
            <MainToolBar
                leftItems={leftItems}
                centerItems={centerItems}
            />
        );
    }

    renderRightView = () => {
        const widgetProps = { headType: 'laser' };
        return (
            <div>
                <div>
                    <button type="button" onClick={() => this.props.switchToPage('laser', PAGE_EDITOR)}>Editor</button>
                    <button type="button" onClick={() => this.props.switchToPage('laser', PAGE_PROCESS)}>Process</button>
                </div>
                {renderWidgetList('laser', 'default', this.props.widgets, allWidgets, this.listActions, widgetProps)}
            </div>

        );
    };


    render() {
        const style = this.props.style;

        return (
            <div style={style}>
                <ProjectLayout
                    renderMainToolBar={this.renderMainToolBar}
                    renderRightView={() => this.renderRightView(this.props.widgets)}
                >
                    <Dropzone
                        disabled={this.state.isDraggingWidget}
                        accept={ACCEPT}
                        dragEnterMsg={i18n._('Drop an image file here.')}
                        onDropAccepted={this.actions.onDropAccepted}
                        onDropRejected={this.actions.onDropRejected}
                    >
                        <LaserVisualizer
                            widgetId="laserVisualizer"
                        />
                    </Dropzone>
                </ProjectLayout>
            </div>
        );
    }
}
const mapStateToProps = (state) => {
    const widget = state.widget;
    const widgets = widget.laser.default.widgets;
    return {
        widgets
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadImage: (file, mode, onFailure) => dispatch(editorActions.uploadImage('laser', file, mode, onFailure)),
        updateTabContainer: (widgets) => dispatch(widgetActions.updateTabContainer('laser', 'default', widgets)),
        switchToPage: (from, page) => dispatch(editorActions.switchToPage(from, page))
    };
};

// https://stackoverflow.com/questions/47657365/can-i-mapdispatchtoprops-without-mapstatetoprops-in-redux
export default connect(mapStateToProps, mapDispatchToProps)(withRouter(Laser));
