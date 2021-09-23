import React, { useState, useEffect, useRef } from 'react';
import { shallowEqual, useSelector, useDispatch } from 'react-redux';
import path from 'path';
import PropTypes from 'prop-types';
import { useHistory, withRouter } from 'react-router-dom';
import 'intro.js/introjs.css';
import i18n from '../../lib/i18n';
import useSetState from '../../lib/hooks/set-state';
import modal from '../../lib/modal';
import LaserVisualizer from '../widgets/LaserVisualizer';

import { renderPopup, logPageView, useUnsavedTitle } from '../utils';
import Dropzone from '../components/Dropzone';
import { actions as editorActions } from '../../flux/editor';
import { actions as laserActions } from '../../flux/laser';
import { actions as projectActions } from '../../flux/project';
import ProjectLayout from '../layouts/ProjectLayout';
import { machineStore } from '../../store/local-storage';
import useRenderMainToolBar from './CncLaserShared/MainToolBar';
import useRenderRemoveModelsWarning from './CncLaserShared/RemoveAllModelsWarning';
import renderJobTypeModal from './CncLaserShared/JobTypeModal';
import renderRightView from './CncLaserShared/RightView';

import { HEAD_LASER, PAGE_PROCESS, PROCESS_MODE_GREYSCALE, PROCESS_MODE_VECTOR } from '../../constants';

import HomePage from './HomePage';
import Workspace from './Workspace';
import Thumbnail from '../widgets/CncLaserShared/Thumbnail';
import { laserCncIntroStepOne, laserCncIntroStepTwo, laserCncIntroStepFive, laserCncIntroStepSix, laser4AxisStepOne } from './introContent';
import Steps from '../components/Steps';

const ACCEPT = '.svg, .png, .jpg, .jpeg, .bmp, .dxf';
const pageHeadType = HEAD_LASER;

function Laser({ location }) {
    const widgets = useSelector(state => state?.widget[pageHeadType]?.default?.widgets, shallowEqual);
    const [isDraggingWidget, setIsDraggingWidget] = useState(false);
    const [showHomePage, setShowHomePage] = useState(false);
    const [showWorkspace, setShowWorkspace] = useState(false);
    const [showJobType, setShowJobType] = useState(true);
    const [enabledIntro, setEnabledIntro] = useState(null);
    const initIndex = 0;
    const coordinateMode = useSelector(state => state[HEAD_LASER]?.coordinateMode, shallowEqual);
    const coordinateSize = useSelector(state => state[HEAD_LASER]?.coordinateSize, shallowEqual);
    const toolPaths = useSelector(state => state[HEAD_LASER]?.toolPathGroup?.getToolPaths(), shallowEqual);
    const materials = useSelector(state => state[HEAD_LASER]?.materials, shallowEqual);
    const series = useSelector(state => state.machine.series, shallowEqual);
    const page = useSelector(state => state[HEAD_LASER]?.page, shallowEqual);
    const { isRotate } = materials;
    const [jobTypeState, setJobTypeState] = useSetState({
        coordinateMode,
        coordinateSize,
        materials
    });
    const dispatch = useDispatch();
    const history = useHistory();
    const thumbnail = useRef();
    const toolPathGroup = useSelector(state => state[HEAD_LASER]?.toolPathGroup, shallowEqual);
    useUnsavedTitle(pageHeadType);

    useEffect(() => {
        dispatch(laserActions.init());
        logPageView({
            pathname: '/laser',
            isRotate
        });
    }, []);

    useEffect(() => {
        setJobTypeState({
            coordinateMode,
            coordinateSize,
            materials
        });
    }, [coordinateMode, coordinateSize, materials]);

    useEffect(() => {
        if (location?.state?.shouldShowJobType) {
            setShowJobType(true);
        } else {
            setShowJobType(false);
        }
    }, [location?.state?.shouldShowJobType]);

    useEffect(() => {
        if (location?.state?.shouldShowGuideTours) {
            setEnabledIntro(true);
        } else if (!location?.state?.shouldShowGuideTours && typeof (location?.state?.shouldShowGuideTours) === 'boolean') {
            setEnabledIntro(false);
        } else {
            setEnabledIntro(null);
        }
    }, [location?.state?.shouldShowGuideTours]);

    useEffect(() => {
        if (typeof (enabledIntro) === 'boolean' && !enabledIntro) {
            machineStore.set(isRotate ? 'guideTours.guideTourslaser4Axis' : 'guideTours.guideTourslaser', true); // mock   ---> true
        }
    }, [enabledIntro]);

    const { setBackgroundModal,
        renderMainToolBar } = useRenderMainToolBar({
        headType: HEAD_LASER,
        setShowHomePage,
        setShowJobType,
        setShowWorkspace
    });
    const renderHomepage = () => {
        const onClose = () => {
            setShowHomePage(false);
            logPageView({
                pathname: '/laser',
                isRotate
            });
        };
        return showHomePage && renderPopup({
            onClose,
            component: HomePage
        });
    };
    const jobTypeModal = renderJobTypeModal(HEAD_LASER, dispatch, showJobType, setShowJobType, jobTypeState, setJobTypeState, coordinateMode, coordinateSize, materials);
    const warningRemovingModels = useRenderRemoveModelsWarning({ headType: HEAD_LASER });
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
            let mode = PROCESS_MODE_GREYSCALE;
            if (path.extname(file.name).toLowerCase() === '.svg' || path.extname(file.name).toLowerCase() === '.dxf') {
                mode = PROCESS_MODE_VECTOR;
            }
            dispatch(editorActions.uploadImage('laser', file, mode, () => {
                modal({
                    cancelTitle: i18n._('key_ui/pages/Laser_Close'),
                    title: i18n._('key_ui/pages/Laser_Import Error'),
                    body: i18n._('Failed to import this object. \nPlease select a supported file format.')
                });
            }));
        },
        onDropRejected: () => {
            modal({
                title: i18n._('key_ui/pages/Laser_Warning'),
                cancelTitle: 'Close',
                body: i18n._('key_ui/pages/Laser_Only {{accept}} files are supported.', { accept: ACCEPT })
            });
        }
    };

    function renderWorkspace() {
        const onClose = () => {
            setShowWorkspace(false);
            logPageView({
                pathname: '/laser',
                isRotate
            });
        };
        return showWorkspace && renderPopup({
            onClose,
            component: Workspace
        });
    }

    function handleExit() {
        // machineStore.set(isRotate ? 'guideTours.guideTourslaser4Axis' : 'guideTours.guideTourslaser', true); // mock   ---> true
        setEnabledIntro(false);
    }

    function handleChange(nextIndex) {
        if (nextIndex === 1) {
            let pathConfig = {};
            if (isRotate) {
                switch (series) {
                    case 'A250':
                        pathConfig = {
                            path: './UserCase/A250/A250_4th_Laser.snaplzr',
                            name: 'A250_4th_Laser.snaplzr'
                        };
                        break;
                    default:
                        pathConfig = {
                            path: './UserCase/A350/A350_4th_Laser.snaplzr',
                            name: 'A350_4th_Laser.snaplzr'
                        };
                        break;
                }
            } else {
                switch (series) {
                    case 'Original Long Z-axis':
                    case 'Original':
                        pathConfig = {
                            path: './UserCase/Origin/Original_Laser.snaplzr',
                            name: 'Original_Laser.snaplzr'
                        };
                        break;
                    case 'A150':
                        pathConfig = {
                            path: './UserCase/A150/A150_Laser.snaplzr',
                            name: 'A150_Laser.snaplzr'
                        };
                        break;
                    case 'A250':
                        pathConfig = {
                            path: './UserCase/A250/A250_Laser.snaplzr',
                            name: 'A250_Laser.snaplzr'
                        };
                        break;
                    case 'A350':
                        pathConfig = {
                            path: './UserCase/A350/A350_Laser.snaplzr',
                            name: 'A350_Laser.snaplzr'
                        };
                        break;
                    default:
                        pathConfig = {
                            path: './UserCase/Origin/Original_Laser.snaplzr',
                            name: 'Original_Laser.snaplzr'
                        };
                        break;
                }
            }
            dispatch(projectActions.openProject(pathConfig, history, true));
        }
    }
    async function handleBeforeChange(nextIndex) {
        if (nextIndex === 4) {
            dispatch(editorActions.switchToPage(HEAD_LASER, PAGE_PROCESS));
            dispatch(editorActions.selectToolPathId(HEAD_LASER, toolPaths[0].id));
        } else if (nextIndex === 6) {
            const thumbnailRef = thumbnail.current.getThumbnail();
            await dispatch(editorActions.preview(HEAD_LASER));
            await dispatch(editorActions.commitGenerateGcode(HEAD_LASER, thumbnailRef));
        }
    }

    return (
        <div>
            <ProjectLayout
                renderMainToolBar={renderMainToolBar}
                renderRightView={
                    () => renderRightView({ headType: HEAD_LASER, dispatch, page, widgets, listActions })
                }
            >
                <Dropzone
                    disabled={isDraggingWidget}
                    accept={ACCEPT}
                    dragEnterMsg={i18n._('key_ui/pages/Laser_Drop an image file here.')}
                    onDropAccepted={actions.onDropAccepted}
                    onDropRejected={actions.onDropRejected}
                >
                    <LaserVisualizer
                        widgetId="laserVisualizer"
                    />
                    <Steps
                        enabled={enabledIntro}
                        initialStep={initIndex}
                        onChange={handleChange}
                        onBeforeChange={handleBeforeChange}
                        options={{
                            showBullets: false,
                            hidePrev: false,
                            exitOnEsc: false,
                            exitOnOverlayClick: false
                        }}
                        steps={[{
                            intro: isRotate ? laser4AxisStepOne(
                                i18n._('key_ui/pages/Laser_Set the work size and where the work origin will be.'),
                                i18n._('key_ui/pages/Laser_D is the diameter of the material,  and L is the length of the material.'),
                                i18n._('key_ui/pages/Laser_Origin is fixed at the edge of the cross-section of the cylinder, far way from the chuck.')
                            ) : laserCncIntroStepOne(
                                i18n._('key_ui/pages/Laser_Set the work size and where the work origin will be.'),
                                i18n._('key_ui/pages/Laser_X is the width of the material,  and Y is the height of the material.'),
                                i18n._('key_ui/pages/Laser_Origin can be set at any corner or the middle of the job. This point (X0, Y0) is the origin of the design coordinate system. It also represents the origin of the workpiece coordinate system that you should set on the material using the machine tool.')
                            ),
                            title: `${i18n._('key_ui/pages/Laser_Job Setup')} (1/8)`
                        }, {
                            element: '.laser-tool-bar-open-icon',
                            title: `${i18n._('key_ui/pages/Laser_Import Object')} (2/8)`,
                            intro: laserCncIntroStepTwo(i18n._('key_ui/pages/Laser_Import an object, or drag an object to Luban.')),
                            disableInteraction: true,
                            tooltipClass: 'laser-import-intro',
                            position: 'right'
                        }, {
                            element: '.laser-draw-intro-part',
                            title: `${i18n._('key_ui/pages/Laser_Draw Object')} (3/8)`,
                            intro: laserCncIntroStepTwo(i18n._('key_ui/pages/Laser_Alternatively, you can draw simple objects or add text for laser engrave or CNC carve.')),
                            disableInteraction: true,
                            tooltipClass: 'laser-draw-intro',
                            position: 'right'
                        }, {
                            // element: '.laser-intro-edit-panel',
                            element: '.widget-list-intro',
                            title: `${i18n._('key_ui/pages/Laser_Edit Panel')} (4/8)`,
                            intro: laserCncIntroStepTwo(i18n._('key_ui/pages/Laser_The Edit panel shows the property related to object. When an object is selected, Luban displays this panel where you can transform the object, switch the Processing Mode, or enter the Process Panel.')),
                            disableInteraction: true,
                            tooltipClass: 'laser-edit-panel-intro',
                            position: 'left'
                        }, {
                            element: '.laser-widget-list-intro',
                            title: `${i18n._('key_ui/pages/Laser_Process Panel')} (5/8)`,
                            intro: laserCncIntroStepFive(
                                i18n._('key_ui/pages/Laser_The Process panel shows the Toolpath List and the relevant property of the toolpath.'),
                                i18n._('key_ui/pages/Laser_After the selected object is edited, click Create Toolpath to create a toolpath of the object. Below the Toolpath List are the parameters you often use.'),
                                i18n._('key_ui/pages/Laser_Create Toolpath')
                            ),
                            disableInteraction: true,
                            position: 'left'
                        }, {
                            element: '.laser-preview-export-intro-part',
                            title: `${i18n._('key_ui/pages/Laser_Generate G-code and Preview')} (6/8)`,
                            position: 'top',
                            disableInteraction: true,
                            intro: laserCncIntroStepSix(
                                i18n._('key_ui/pages/Laser_Click to generate and preview the G-code file.'),
                                i18n._('key_ui/pages/Laser_For laser engraving, you can preview the toolpath. For CNC carving, you can preview the toolpath and simulate the operation result.'),
                                // isRotate ? '/resources/images/guide-tours/laser_4_axis_priview.png' : '/resources/images/guide-tours/laser_3_axis_priview.png'
                                isRotate,
                                series,
                                'laser'
                            )
                        }, {
                            element: '.laser-preview-export-intro-part',
                            title: `${i18n._('key_ui/pages/Laser_Export')} (7/8)`,
                            position: 'top',
                            disableInteraction: true,
                            intro: laserCncIntroStepTwo(
                                i18n._('key_ui/pages/Laser_Export the G-code file to a local device or load it to Workspace. Use Touchscreen or Luban to start laser engraving or CNC carving.')
                            )
                        }, {
                            element: '.laser-save-icon',
                            title: `${i18n._('key_ui/pages/Laser_Save Project')} (8/8)`,
                            position: 'bottom',
                            disableInteraction: true,
                            intro: laserCncIntroStepTwo(i18n._('key_ui/pages/Laser_Save the project to a local device for reuse.'))
                        }]}
                        onExit={handleExit}
                    />
                </Dropzone>
                <Thumbnail
                    ref={thumbnail}
                    toolPathGroup={toolPathGroup}
                />
            </ProjectLayout>
            {warningRemovingModels}
            {jobTypeModal}
            {setBackgroundModal}
            {renderHomepage()}
            {renderWorkspace()}
        </div>
    );
}
Laser.propTypes = {
    // history: PropTypes.object
    location: PropTypes.object
};
export default withRouter(Laser);
