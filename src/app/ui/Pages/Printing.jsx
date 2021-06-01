import React, { useState, useEffect } from 'react';
import { shallowEqual, useSelector, useDispatch } from 'react-redux';
import Sortable from 'react-sortablejs';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
import Widget from '../widgets/Widget';
import PrintingVisualizer from '../widgets/PrintingVisualizer';
import PrintingManager from '../views/PrintingManager';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import Dropzone from '../components/Dropzone';
import { actions as printingActions } from '../../flux/printing';
import { actions as widgetActions } from '../../flux/widget';
import { actions as projectActions } from '../../flux/project';
import ProjectLayout from '../Layouts/ProjectLayout';
import MainToolBar from '../Layouts/MainToolBar';
import { HEAD_3DP, HEAD_CNC, HEAD_LASER } from '../../constants';

function getCurrentHeadType(pathname) {
    let headType = null;
    if (pathname.indexOf(HEAD_CNC) >= 0) headType = HEAD_CNC;
    if (pathname.indexOf(HEAD_LASER) >= 0) headType = HEAD_LASER;
    if (pathname.indexOf(HEAD_3DP) >= 0) headType = HEAD_3DP;
    return headType;
}
function Printing({ history, location }) {
    const widgets = useSelector(state => state?.widget['3dp'].default.widgets, shallowEqual);
    const [isDraggingWidget, setIsDraggingWidget] = useState(false);
    const dispatch = useDispatch();
    useEffect(() => {
        return async () => {
            const headType = getCurrentHeadType(location.pathname);
            if (!headType) {
                return;
            }
            dispatch(projectActions.save(headType));
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
    function onDragWidgetStart() {
        setIsDraggingWidget(true);
    }
    function onDragWidgetEnd() {
        setIsDraggingWidget(false);
    }
    function onChangeWidgetOrder(newWidgets) {
        dispatch(widgetActions.updateTabContainer('3dp', 'default', newWidgets));
    }

    function renderMainToolBar() {
        const leftItems = [
            {
                title: 'Copy',
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

    function renderCenterView() {
        return (
            <Dropzone
                disabled={isDraggingWidget}
                accept=".stl, .obj"
                dragEnterMsg={i18n._('Drop an STL/OBJ file here.')}
                onDropAccepted={onDropAccepted}
                onDropRejected={onDropRejected}
            >
                <PrintingVisualizer widgetId="printingVisualizer" />
            </Dropzone>
        );
    }

    function renderModalView() {
        return (<PrintingManager />);
    }

    function renderRightView(newWidgets) {
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
                    onStart: onDragWidgetStart,
                    onEnd: onDragWidgetEnd
                }}
                onChange={onChangeWidgetOrder}
            >
                { newWidgets.map(widget => {
                    return (
                        <div data-widget-id={widget} key={widget}>
                            <Widget widgetId={widget} width="360px" />
                        </div>
                    );
                })}
            </Sortable>
        );
    }

    return (
        <ProjectLayout
            renderCenterView={renderCenterView}
            renderMainToolBar={renderMainToolBar}
            renderRightView={() => renderRightView(widgets)}
            renderModalView={renderModalView}
        />
    );
}
Printing.propTypes = {
    history: PropTypes.object,
    location: PropTypes.object
};

export default (withRouter(Printing));
