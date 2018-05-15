import _ from 'lodash';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../../components/Modal';
import i18n from '../../../lib/i18n';
import store from '../../../store';
import WidgetList from './WidgetList';

class WidgetManager extends Component {
    static propTypes = {
        onSave: PropTypes.func,
        onClose: PropTypes.func.isRequired
    };
    state = {
        show: true
    };
    widgetList = [
        {
            id: 'visualizer',
            caption: i18n._('Visualizer Widget'),
            details: i18n._('This widget visualizes a G-code file and simulates the tool path.'),
            visible: true,
            disabled: true
        },
        {
            id: 'connection',
            caption: i18n._('Connection Widget'),
            details: i18n._('This widget lets you establish a connection to a serial port.'),
            visible: true,
            disabled: true
        },
        {
            id: 'console',
            caption: i18n._('Console Widget'),
            details: i18n._('This widget lets you read and write data to the CNC controller connected to a serial port.'),
            visible: true,
            disabled: false
        },
        {
            id: 'grbl',
            caption: i18n._('Grbl Widget'),
            details: i18n._('This widget can view Grbl state and settings.'),
            visible: true,
            disabled: false
        },
        {
            id: 'marlin',
            caption: i18n._('Marlin Widget'),
            details: i18n._('This widget can view Marlin state and settings.'),
            visible: true,
            disabled: false
        },
        {
            id: 'smoothie',
            caption: i18n._('Smoothie Widget'),
            details: i18n._('This widget can view Smoothie state and settings.'),
            visible: true,
            disabled: false
        },
        {
            id: 'tinyg',
            caption: i18n._('TinyG Widget'),
            details: i18n._('This widget can view TinyG state and settings.'),
            visible: true,
            disabled: false
        },
        {
            id: 'axes',
            caption: i18n._('Axes Widget'),
            details: i18n._('This widget shows the XYZ position. It includes jog controls, homing, and axis zeroing.'),
            visible: true,
            disabled: false
        },
        {
            id: 'gcode',
            caption: i18n._('G-code Widget'),
            details: i18n._('This widget shows the current status of G-code commands.'),
            visible: true,
            disabled: false
        },
        {
            id: 'laser',
            caption: i18n._('Laser Widget'),
            details: i18n._('This widget allows you control laser intensity and turn the laser on/off.'),
            visible: true,
            disabled: false
        },
        {
            id: 'macro',
            caption: i18n._('Macro Widget'),
            details: i18n._('This widget can use macros to automate routine tasks.'),
            visible: true,
            disabled: false
        },
        {
            id: 'probe',
            caption: i18n._('Probe Widget'),
            details: i18n._('This widget helps you use a touch plate to set your Z zero offset.'),
            visible: true,
            disabled: false
        },
        {
            id: 'spindle',
            caption: i18n._('Spindle Widget'),
            details: i18n._('This widget provides the spindle control.'),
            visible: true,
            disabled: false
        },
        {
            id: 'webcam',
            caption: i18n._('Webcam Widget'),
            details: i18n._('This widget lets you monitor a webcam.'),
            visible: true,
            disabled: false
        }
    ];
    actions = {
        handleChange: (id, checked) => {
            let o = _.find(this.widgetList, { id: id });
            if (o) {
                o.visible = checked;
            }
        },
        handleSave: () => {
            this.setState({ show: false });

            const activeWidgets = _(this.widgetList)
                .filter(item => item.visible)
                .map(item => item.id)
                .value();
            const inactiveWidgets = _(this.widgetList)
                .map('id')
                .difference(activeWidgets)
                .value();

            this.props.onSave(activeWidgets, inactiveWidgets);
        },
        handleCancel: () => {
            this.setState({ show: false });
        }
    };

    componentDidUpdate() {
        if (!(this.state.show)) {
            this.props.onClose();
        }
    }

    render() {
        const defaultWidgets = store.get('workspace.container.default.widgets', [])
            .map(widgetId => widgetId.split(':')[0]);
        const primaryWidgets = store.get('workspace.container.primary.widgets', [])
            .map(widgetId => widgetId.split(':')[0]);
        const secondaryWidgets = store.get('workspace.container.secondary.widgets', [])
            .map(widgetId => widgetId.split(':')[0]);
        const activeWidgets = _.union(defaultWidgets, primaryWidgets, secondaryWidgets);

        this.widgetList.forEach((widget) => {
            widget.visible = _.includes(activeWidgets, widget.id);
        });

        const actions = this.actions;

        return (
            <Modal
                onClose={actions.handleCancel}
                show={this.state.show}
                size="md"
            >
                <Modal.Header>
                    <Modal.Title>{i18n._('Widgets')}</Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ padding: 0 }}>
                    <WidgetList list={this.widgetList} onChange={actions.handleChange} />
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type="button"
                        className="btn btn-default"
                        onClick={actions.handleCancel}
                    >
                        {i18n._('Cancel')}
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={actions.handleSave}
                    >
                        {i18n._('OK')}
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

export default WidgetManager;
