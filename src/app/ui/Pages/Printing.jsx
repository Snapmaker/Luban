import React, { PureComponent } from 'react';
import Sortable from 'react-sortablejs';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
import { connect } from 'react-redux';
import Widget from '../../widgets/Widget';
import PrintingVisualizer from '../../widgets/PrintingVisualizer';
import PrintingManager from '../../views/PrintingManager';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import Dropzone from '../../components/Dropzone';
import { actions as printingActions } from '../../flux/printing';
import { actions as widgetActions } from '../../flux/widget';
import ProjectLayout from '../Layouts/ProjectLayout';
import MainToolBar from '../Layouts/MainToolBar';


class Printing extends PureComponent {
    static propTypes = {
        ...withRouter.propTypes,
        widgets: PropTypes.array.isRequired,
        uploadModel: PropTypes.func.isRequired,
        updateTabContainer: PropTypes.func.isRequired
    };

    state = {
        isDraggingWidget: false
    };

    actions = {
        onDropAccepted: async (file) => {
            try {
                await this.props.uploadModel(file);
            } catch (e) {
                modal({
                    title: i18n._('Failed to open model.'),
                    body: e.message
                });
            }
        },
        onDropRejected: () => {
            const title = i18n._('Warning');
            const body = i18n._('Only STL/OBJ files are supported.');
            modal({
                title: title,
                body: body
            });
        },
        onDragWidgetStart: () => {
            this.setState({ isDraggingWidget: true });
        },
        onDragWidgetEnd: () => {
            this.setState({ isDraggingWidget: false });
        },
        onChangeWidgetOrder: (widgets) => {
            this.props.updateTabContainer({ widgets: widgets });
        }
    };

    renderMainToolBar = () => {
        const locationArray = [
            {
                title: 'Copy',
                action: () => this.props.history.push('laser')
            }
        ];
        const projectArray = [
            {
                title: 'Edit',
                action: () => this.props.history.push('cnc')
            }
        ];
        return (
            <MainToolBar
                locationArray={locationArray}
                projectArray={projectArray}
            />
        );
    }

    renderCenterView = () => {
        return (
            <Dropzone
                disabled={this.state.isDraggingWidget}
                accept=".stl, .obj"
                dragEnterMsg={i18n._('Drop an STL/OBJ file here.')}
                onDropAccepted={this.actions.onDropAccepted}
                onDropRejected={this.actions.onDropRejected}
            >
                <PrintingVisualizer widgetId="printingVisualizer" />
            </Dropzone>
        );
    };

    renderModalView = () => {
        return (<PrintingManager />);
    };

    renderRightView = (widgets) => {
        console.log('materialDefinition', widgets);
        return (
            <Sortable
                options={{
                    animation: 150,
                    delay: 0,
                    group: {
                        name: '3dp-control'
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
                { widgets.map(widget => {
                    return (
                        <div data-widget-id={widget} key={widget}>
                            <Widget widgetId={widget} width="360px" />
                        </div>
                    );
                })}
            </Sortable>
        );
    }

    render() {
        return (
            <ProjectLayout
                renderCenterView={this.renderCenterView}
                renderMainToolBar={this.renderMainToolBar}
                renderRightView={() => this.renderRightView(this.props.widgets)}
                renderModalView={this.renderModalView}
            />
        );
    }
}
const mapStateToProps = (state) => {
    const widget = state.widget;
    const widgets = widget['3dp'].default.widgets;
    return {
        widgets
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        uploadModel: (file) => dispatch(printingActions.uploadModel(file)),
        updateTabContainer: (widgets) => dispatch(widgetActions.updateTabContainer('3dp', 'default', widgets))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withRouter(Printing));
