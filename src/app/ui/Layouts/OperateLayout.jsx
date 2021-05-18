import React, { PureComponent } from 'react';
// import Sortable from 'react-sortablejs';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import classNames from 'classnames';
import Widget from '../../widgets/Widget';
// import PrintingVisualizer from '../../widgets/PrintingVisualizer';
// import PrintingManager from '../../views/PrintingManager';
import styles from './layout.styl';
// import i18n from '../../lib/i18n';
// import modal from '../../lib/modal';
// import Dropzone from '../../components/Dropzone';
// import { actions as printingActions } from '../../flux/printing';
// import { actions as widgetActions } from '../../flux/widget';


class OperateLayout extends PureComponent {
    static propTypes = {
        // widgets: PropTypes.array.isRequired,
        // hidden: PropTypes.bool.isRequired,
        leftView: PropTypes.array,
        rightView: PropTypes.array,
        centerView: PropTypes.array,
        mainToolBar: PropTypes.array,
        subToolBar: PropTypes.array
    };

    state = {
        // isDraggingWidget: false
    };

    actions = {

        // onDragWidgetStart: () => {
        //     this.setState({ isDraggingWidget: true });
        // },
        // onDragWidgetEnd: () => {
        //     this.setState({ isDraggingWidget: false });
        // }
    };

    // onChangeWidgetOrder = (widgets) => {
    //     this.props.updateTabContainer({ widgets: widgets });
    // };

    render() {
        const { leftView, rightView, centerView, mainToolBar, subToolBar } = this.props;
        return (
            <div>
                <div className={styles['content-table']}>
                    <div className={styles['content-row']}>
                        <div className={styles['main-bar']}>
                            <div>
                                ddd
                            </div>
                            { mainToolBar && mainToolBar.map(widget => {
                                return (
                                    <div data-widget-id={widget} key={widget}>
                                        <Widget widgetId={widget} />
                                    </div>
                                );
                            })}
                        </div>
                        <form
                            className={classNames(
                                styles.controls,
                                styles['controls-left'],
                            )}
                            noValidate
                        >
                            { leftView && leftView.map(widget => {
                                return (
                                    <div data-widget-id={widget} key={widget}>
                                        <Widget widgetId={widget} />
                                    </div>
                                );
                            })}

                        </form>
                        <form
                            className={classNames(
                                styles.controls,
                                styles['controls-right'],
                            )}
                            noValidate
                        >
                            { rightView && rightView.map(widget => {
                                return (
                                    <div data-widget-id={widget} key={widget}>
                                        <Widget widgetId={widget} />
                                    </div>
                                );
                            })}

                        </form>
                        <div
                            className={classNames(
                                styles.visualizer,
                            )}
                        >
                            { centerView && centerView.map(widget => {
                                return (
                                    <div data-widget-id={widget} key={widget}>
                                        <Widget widgetId={widget} />
                                    </div>
                                );
                            })}
                        </div>
                        { subToolBar && subToolBar.map(widget => {
                            return (
                                <div data-widget-id={widget} key={widget}>
                                    <Widget widgetId={widget} />
                                </div>
                            );
                        })}
                    </div>
                </div>
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

// const mapDispatchToProps = (dispatch) => {
//     return {
//         // uploadModel: (file) => dispatch(printingActions.uploadModel(file)),
//         updateTabContainer: (widgets) => dispatch(widgetActions.updateTabContainer('3dp', 'default', widgets))
//     };
// };

export default connect(mapStateToProps)(OperateLayout);
