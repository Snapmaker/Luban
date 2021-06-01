import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import Sortable from 'react-sortablejs';
import path from 'path';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import Dropzone from '../components/Dropzone';
import CNCVisualizer from '../widgets/CNCVisualizer';
import Widget from '../widgets/Widget';
import ProjectLayout from '../Layouts/ProjectLayout';
import MainToolBar from '../Layouts/MainToolBar';

import { actions as widgetActions } from '../../flux/widget';
import { actions as editorActions } from '../../flux/editor';
import CncToolManager from '../views/CncToolManager/CncToolManager';
import { PROCESS_MODE_GREYSCALE, PROCESS_MODE_MESH, PROCESS_MODE_VECTOR } from '../../constants';


const ACCEPT = '.svg, .png, .jpg, .jpeg, .bmp, .dxf, .stl';

class Cnc extends Component {
    static propTypes = {
        ...withRouter.propTypes,
        style: PropTypes.object,
        widgets: PropTypes.array.isRequired,
        uploadImage: PropTypes.func.isRequired,
        updateTabContainer: PropTypes.func.isRequired
    };

    state = {
        isDraggingWidget: false
    };

    actions = {
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
            this.props.uploadImage(file, uploadMode, () => {
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
                title: 'Copy',
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

    renderCenterView = () => {
        return (
            <Dropzone
                disabled={this.state.isDraggingWidget}
                accept={ACCEPT}
                dragEnterMsg={i18n._('Drop an image file here.')}
                onDropAccepted={this.actions.onDropAccepted}
                onDropRejected={this.actions.onDropRejected}
            >
                <CNCVisualizer />
            </Dropzone>
        );
    };

    renderModalView = () => {
        return (<CncToolManager />);
    };

    renderRightView = (widgets) => {
        return (
            <Sortable
                options={{
                    animation: 150,
                    delay: 0,
                    group: {
                        name: 'cnc-control'
                    },
                    handle: '.sortable-handle',
                    filter: '.sortable-filter',
                    chosenClass: 'sortable-chosen',
                    ghostClass: 'sortable-ghost',
                    dataIdAttr: 'data-widget-id',
                    onStart: this.actions.onDragWidgetStart,
                    onEnd: this.actions.onDragWidgetEnd
                }}
                onChange={this.actions.onChangeWidgetOrder}
            >
                {widgets.map(widget => {
                    return (
                        <div data-widget-id={widget} key={widget}>
                            <Widget widgetId={widget} headType="cnc" width="360px" />
                        </div>
                    );
                })}
            </Sortable>
        );
    }

    render() {
        const style = this.props.style;

        return (
            <div style={style}>
                <ProjectLayout
                    renderCenterView={this.renderCenterView}
                    renderMainToolBar={this.renderMainToolBar}
                    renderRightView={() => this.renderRightView(this.props.widgets)}
                    renderModalView={this.renderModalView}
                />
            </div>
        );
    }
}
const mapStateToProps = (state) => {
    const widget = state.widget;
    const widgets = widget.cnc.default.widgets;
    return {
        widgets
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadImage: (file, mode, onFailure) => dispatch(editorActions.uploadImage('cnc', file, mode, onFailure)),
        updateTabContainer: (widgets) => dispatch(widgetActions.updateTabContainer('cnc', 'default', widgets))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withRouter(Cnc));
