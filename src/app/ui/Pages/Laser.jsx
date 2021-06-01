import React, { Component } from 'react';
import path from 'path';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import Sortable from 'react-sortablejs';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import LaserVisualizer from '../../widgets/LaserVisualizer';
import Widget from '../../widgets/Widget';
import Dropzone from '../../components/Dropzone';
import { actions as editorActions } from '../../flux/editor';
import { actions as widgetActions } from '../../flux/widget';
// import styles from './styles.styl';
import ProjectLayout from '../Layouts/ProjectLayout';
import MainToolBar from '../Layouts/MainToolBar';

const ACCEPT = '.svg, .png, .jpg, .jpeg, .bmp, .dxf';

class Laser extends Component {
    static propTypes = {
        ...withRouter.propTypes,
        widgets: PropTypes.array.isRequired,
        style: PropTypes.object,
        uploadImage: PropTypes.func.isRequired,
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
                title: 'Copy',
                type: 'item',
                action: () => this.props.history.push('/')
            },
            {
                type: 'separator'
            }
        ];
        const centerItems = [
            {
                type: 'item',
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
                <LaserVisualizer
                    widgetId="laserVisualizer"
                />
            </Dropzone>
        );
    };

    renderRightView = (widgets) => {
        return (
            <Sortable
                options={{
                    animation: 150,
                    delay: 0,
                    group: {
                        name: 'laser-control'
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
                            <Widget widgetId={widget} headType="laser" width="360px" />
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
                />
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
        updateTabContainer: (widgets) => dispatch(widgetActions.updateTabContainer('laser', 'default', widgets))
    };
};

// https://stackoverflow.com/questions/47657365/can-i-mapdispatchtoprops-without-mapstatetoprops-in-redux
export default connect(mapStateToProps, mapDispatchToProps)(withRouter(Laser));
