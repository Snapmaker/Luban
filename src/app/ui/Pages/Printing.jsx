import React, { PureComponent } from 'react';
import Sortable from 'react-sortablejs';
import PropTypes from 'prop-types';
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


class Printing extends PureComponent {
    static propTypes = {
        widgets: PropTypes.array.isRequired,
        hidden: PropTypes.bool.isRequired,
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
        }
    };

    onChangeWidgetOrder = (widgets) => {
        this.props.updateTabContainer({ widgets: widgets });
    };

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

    renderRightView = () => {
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
                onChange={this.onChangeWidgetOrder}
            >
                { this.props.widgets.map(widget => {
                    return (
                        <div data-widget-id={widget} key={widget}>
                            <Widget widgetId={widget} />
                        </div>
                    );
                })}
            </Sortable>
        );
    }

    render() {
        const { hidden } = this.props;
        return (
            <div style={{ display: hidden ? 'none' : 'block' }}>
                <ProjectLayout
                    centerView={this.renderCenterView}
                    rightView={this.renderRightView}
                    modalView={this.renderModalView}
                />
            </div>
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

export default connect(mapStateToProps, mapDispatchToProps)(Printing);
