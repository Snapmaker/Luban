import React, { useState, useEffect, useRef } from 'react';

import { shallowEqual, useSelector, useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import { useHistory, withRouter } from 'react-router-dom';
import path from 'path';
import { Trans } from 'react-i18next';
import 'intro.js/introjs.css';
import Steps from '../components/Steps';
import i18n from '../../lib/i18n';
import modal from '../../lib/modal';
import Dropzone from '../components/Dropzone';
import SvgIcon from '../components/SvgIcon';
import Space from '../components/Space';
import { renderModal, renderPopup, logPageView, useUnsavedTitle } from '../utils';
import Checkbox from '../components/Checkbox';
import { Button } from '../components/Buttons';

import CNCVisualizer from '../widgets/CNCVisualizer';
import ProjectLayout from '../layouts/ProjectLayout';

import { actions as projectActions } from '../../flux/project';
import { actions as cncActions } from '../../flux/cnc';
import { actions as editorActions } from '../../flux/editor';

import { actions as machineActions } from '../../flux/machine';

import {
    PROCESS_MODE_GREYSCALE,
    PROCESS_MODE_MESH,
    PROCESS_MODE_VECTOR,
    HEAD_CNC
} from '../../constants';

import useRenderMainToolBar from './CncLaserShared/MainToolBar';
import useRenderRemoveModelsWarning from './CncLaserShared/RemoveAllModelsWarning';
import renderJobTypeModal from './CncLaserShared/JobTypeModal';
import renderRightView from './CncLaserShared/RightView';

import HomePage from './HomePage';
import Workspace from './Workspace';
import { machineStore } from '../../store/local-storage';
import Thumbnail from '../widgets/CncLaserShared/Thumbnail';
import { laserCncIntroStepOne, laserCncIntroStepTwo, laserCncIntroStepFive, laserCncIntroStepSix, cnc4AxisStepOne } from './introContent';
import useSetState from '../../lib/hooks/set-state';

const ACCEPT = '.svg, .png, .jpg, .jpeg, .bmp, .dxf, .stl';
const pageHeadType = HEAD_CNC;
function useRenderWarning() {
    const [showWarning, setShowWarning] = useState(false);
    const dispatch = useDispatch();

    const onClose = () => setShowWarning(false);

    function onChangeShouldShowWarning(value) {
        dispatch(machineActions.setShouldShowCncWarning(value));
    }

    return showWarning && renderModal({
        onClose,
        renderBody: () => (
            <div style={{ width: '432px' }}>
                <SvgIcon
                    color="#FFA940"
                    type="static"
                    className="display-block width-72 margin-auto"
                    name="WarningTipsWarning"
                    size="72"
                />
                <div className="align-c font-weight-bold margin-bottom-16">
                    {i18n._('key-Cnc/Page-Warning')}
                </div>
                <div>
                    <Trans i18nKey="key_CNC_loading_warning">
                        This is an alpha version that gets you started with CNC carving. Ensure you have read
                        <Space width={4} />
                        <a
                            style={{ color: '#28a7e1' }}
                            href="https://manual.snapmaker.com/cnc_carving/read_this_first_-_safety_information.html"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            the Safety Information
                        </a>
                        <Space width={4} />
                        before proceeding.
                    </Trans>
                </div>
            </div>
        ),
        renderFooter: () => (
            <div className="sm-flex justify-space-between">
                <div className="display-inline height-32">
                    <Checkbox
                        id="footer-input"
                        defaultChecked={false}
                        onChange={onChangeShouldShowWarning}
                    />
                    <span className="margin-left-4">{i18n._('Don\'t show again')}</span>
                </div>
                <Button
                    type="default"
                    width="96px"
                    priority="level-two"
                    onClick={onClose}
                >
                    {i18n._('key-Cnc/Page-Cancel')}
                </Button>
            </div>
        )
    });
}

function Cnc({ location }) {
    const widgets = useSelector(state => state?.widget[pageHeadType]?.default?.widgets, shallowEqual);
    const [isDraggingWidget, setIsDraggingWidget] = useState(false);
    const [showHomePage, setShowHomePage] = useState(false);
    const [showWorkspace, setShowWorkspace] = useState(false);
    const [showJobType, setShowJobType] = useState(true);
    const [enabledIntro, setEnabledIntro] = useState(null);
    const initIndex = 0;
    const toolPaths = useSelector(state => state[HEAD_CNC]?.toolPathGroup?.getToolPaths(), shallowEqual);
    const toolPathGroup = useSelector(state => state[HEAD_CNC]?.toolPathGroup, shallowEqual);
    const coordinateMode = useSelector(state => state[HEAD_CNC]?.coordinateMode, shallowEqual);
    const coordinateSize = useSelector(state => state[HEAD_CNC]?.coordinateSize, shallowEqual);
    const materials = useSelector(state => state[HEAD_CNC]?.materials, shallowEqual);
    const [jobTypeState, setJobTypeState] = useSetState({
        coordinateMode,
        coordinateSize,
        materials
    });
    const { isRotate } = materials;
    const dispatch = useDispatch();
    const history = useHistory();
    const page = useSelector(state => state?.cnc.page);
    useUnsavedTitle(pageHeadType);
    const thumbnail = useRef();
    const series = useSelector(state => state.machine.series, shallowEqual);
    useEffect(() => {
        dispatch(cncActions.init());
        logPageView({
            pathname: '/cnc',
            isRotate: materials?.isRotate
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
            machineStore.set(isRotate ? 'guideTours.guideTourscnc4Axis' : 'guideTours.guideTourscnc', true);
        }
    }, [enabledIntro]);

    const { renderStlModal, renderMainToolBar } = useRenderMainToolBar({
        headType: HEAD_CNC,
        setShowHomePage,
        setShowJobType,
        setShowWorkspace
    });

    const renderHomepage = () => {
        const onClose = () => {
            setShowHomePage(false);
            logPageView({
                pathname: '/cnc',
                isRotate: materials?.isRotate
            });
        };
        return showHomePage && renderPopup({
            onClose,
            component: HomePage,
            key: 'homepage'
        });
    };
    const jobTypeModal = renderJobTypeModal(HEAD_CNC, dispatch, showJobType, setShowJobType, jobTypeState, setJobTypeState, coordinateMode, coordinateSize, materials);
    const warningModal = useRenderWarning();
    const removeModelsWarningModal = useRenderRemoveModelsWarning({ headType: HEAD_CNC });
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
            dispatch(editorActions.uploadImage('cnc', file, uploadMode, () => {
                modal({
                    cancelTitle: i18n._('key-Cnc/Page-Close'),
                    title: i18n._('key-Cnc/Page-Import Error'),
                    body: i18n._('Failed to import this object. \nPlease select a supported file format.')
                });
            }));
        },
        onDropRejected: () => {
            modal({
                title: i18n._('key-Cnc/Page-Warning'),
                cancelTitle: 'Close',
                body: i18n._('key-Cnc/Page-Only {{accept}} files are supported.', { accept: ACCEPT })
            });
        }
    };

    function renderWorkspace() {
        const onClose = () => {
            setShowWorkspace(false);
            logPageView({
                pathname: '/cnc',
                isRotate: materials?.isRotate
            });
        };
        return showWorkspace && renderPopup({
            onClose,
            component: Workspace,
            key: 'workspace'
        });
    }

    function handleChange(nextIndex) {
        if (nextIndex === 1) {
            let pathConfig = {};
            if (isRotate) {
                pathConfig = {
                    path: './UserCase/cnc/a250_standard/cnc_4th_a250a350_standard.snapcnc',
                    name: 'cnc_4th_a250a350_standard.snapcnc'
                };
            } else {
                switch (series) {
                    case 'Original Long Z-axis':
                    case 'Original':
                        pathConfig = {
                            path: './UserCase/cnc/original_standard/cnc_original_standard.snapcnc',
                            name: 'cnc_original_standard.snapcnc'
                        };
                        break;
                    case 'A150':
                        pathConfig = {
                            path: './UserCase/cnc/a150_standard/cnc_a150_standard.snapcnc',
                            name: 'cnc_a150_standard.snapcnc'
                        };
                        break;
                    case 'A250':
                        pathConfig = {
                            path: './UserCase/cnc/a250_standard/cnc_a250_standard.snapcnc',
                            name: 'cnc_a250_standard.snapcnc'
                        };
                        break;
                    case 'A350':
                        pathConfig = {
                            path: './UserCase/cnc/a350_standard/cnc_a350_standard.snapcnc',
                            name: 'cnc_a350_standard.snapcnc'
                        };
                        break;
                    default:
                        break;
                }
            }
            dispatch(projectActions.openProject(pathConfig, history, true, true));
        }
    }
    async function handleBeforeChange(nextIndex) {
        if (nextIndex === 4) {
            dispatch(editorActions.switchToPage(HEAD_CNC, 'process'));
            dispatch(editorActions.selectToolPathId(HEAD_CNC, toolPaths[0].id));
        } else if (nextIndex === 6) {
            const thumbnailRef = thumbnail.current.getThumbnail();
            await dispatch(editorActions.preview(HEAD_CNC));
            await dispatch(editorActions.commitGenerateGcode(HEAD_CNC, thumbnailRef));
        }
    }
    function handleExit() {
        setEnabledIntro(false);
    }
    return (
        <div>
            <ProjectLayout
                renderMainToolBar={renderMainToolBar}
                renderRightView={
                    () => renderRightView({ headType: HEAD_CNC, dispatch, page, widgets, listActions })
                }
            >
                <Dropzone
                    disabled={isDraggingWidget}
                    accept={ACCEPT}
                    dragEnterMsg={i18n._('key-Cnc/Page-Drop an image file here.')}
                    onDropAccepted={actions.onDropAccepted}
                    onDropRejected={actions.onDropRejected}
                >
                    <CNCVisualizer />
                    {enabledIntro && (
                        <Steps
                            options={{
                                showBullets: false
                            }}
                            enabled={enabledIntro}
                            initialStep={initIndex}
                            onChange={handleChange}
                            onBeforeChange={handleBeforeChange}
                            onExit={handleExit}
                            steps={[
                                {
                                    intro: isRotate ? cnc4AxisStepOne(
                                        i18n._('key-Cnc/Page-Set the work size and where the work origin will be.'),
                                        i18n._('key-Cnc/Page-D is the diameter of the material,  and L is the length of the material.'),
                                        i18n._('key-Cnc/Page-Origin is fixed at the center of the cross-section of the cylinder, far way from the chuck.')
                                    ) : laserCncIntroStepOne(
                                        i18n._('key-Cnc/Page-Set the work size and where the work origin will be.'),
                                        i18n._('key-Cnc/Page-X is the width of the material,  and Y is the height of the material.'),
                                        i18n._('key-Cnc/Page-Origin can be set at any corner or the middle of the job. This point (X0, Y0) is the origin of the design coordinate system. It also represents the origin of the workpiece coordinate system that you should set on the material using the machine tool.')
                                    ),
                                    title: `${i18n._('key-Cnc/Page-Job Setup')} (1/8)`
                                }, {
                                    element: '.cnc-tool-bar-open-icon',
                                    title: `${i18n._('key-Cnc/Page-Import Object')} (2/8)`,
                                    intro: laserCncIntroStepTwo(i18n._('key-Cnc/Page-Import an object, or drag an object to Luban.')),
                                    disableInteraction: true,
                                    tooltipClass: 'cnc-import-intro',
                                    position: 'right'
                                }, {
                                    element: '.cnc-draw-intro-part',
                                    title: `${i18n._('key-Cnc/Page-Draw Object')} (3/8)`,
                                    intro: laserCncIntroStepTwo(i18n._('key-Cnc/Page-Alternatively, you can draw simple objects or add text for laser engrave or CNC carve.')),
                                    disableInteraction: true,
                                    tooltipClass: 'cnc-draw-intro',
                                    position: 'right'
                                }, {
                                // element: '.laser-intro-edit-panel',
                                    element: '.widget-list-intro',
                                    title: `${i18n._('key-Cnc/Page-Edit Panel')} (4/8)`,
                                    intro: laserCncIntroStepTwo(i18n._('key-Cnc/Page-The Edit panel shows the property related to object. When an object is selected, Luban displays this panel where you can transform the object, switch the Processing Mode, or enter the Process Panel.')),
                                    disableInteraction: true,
                                    tooltipClass: 'cnc-edit-panel-intro',
                                    position: 'left'
                                }, {
                                    element: '.cnc-widget-list-intro',
                                    title: `${i18n._('key-Cnc/Page-Process Panel')} (5/8)`,
                                    intro: laserCncIntroStepFive(
                                        i18n._('key-Cnc/Page-The Process panel shows the Toolpath List and the relevant property of the toolpath.'),
                                        i18n._('key-Cnc/Page-After the selected object is edited, click Create Toolpath to create a toolpath of the object. Below the Toolpath List are the parameters you often use.'),
                                        i18n._('key-Cnc/Page-Create Toolpath')
                                    ),
                                    disableInteraction: true,
                                    position: 'left'
                                }, {
                                    element: '.cnc-preview-export-intro-part',
                                    title: `${i18n._('key-Cnc/Page-Generate G-code and Preview')} (6/8)`,
                                    position: 'top',
                                    disableInteraction: true,
                                    intro: laserCncIntroStepSix(
                                        i18n._('key-Cnc/Page-Click to generate and preview the G-code file.'),
                                        i18n._('key-Cnc/Page-For laser engraving, you can preview the toolpath. For CNC carving, you can preview the toolpath and simulate the operation result.'),
                                        // isRotate ? '/resources/images/guide-tours/cnc_4_axis_priview.png' : '/resources/images/guide-tours/cnc_3_axis_priview.png'
                                        isRotate,
                                        series,
                                        'cnc'
                                    )
                                }, {
                                    element: '.cnc-preview-export-intro-part',
                                    title: `${i18n._('key-Cnc/Page-Export')} (7/8)`,
                                    position: 'top',
                                    disableInteraction: true,
                                    intro: laserCncIntroStepTwo(
                                        i18n._('key-Cnc/Page-Export the G-code file to a local device or load it to Workspace. Use Touchscreen or Luban to start laser engraving or CNC carving.')
                                    )
                                }, {
                                    element: '.cnc-laser-save-icon',
                                    title: `${i18n._('key-Cnc/Page-Save Project')} (8/8)`,
                                    position: 'bottom',
                                    disableInteraction: true,
                                    intro: laserCncIntroStepTwo(i18n._('key-Cnc/Page-Save the project to a local device for reuse.'))
                                }
                            ]}
                        />
                    )}
                </Dropzone>
                <Thumbnail
                    ref={thumbnail}
                    toolPathGroup={toolPathGroup}
                />
            </ProjectLayout>
            {warningModal}
            {removeModelsWarningModal}
            {jobTypeModal}
            {renderStlModal()}
            {renderHomepage()}
            {renderWorkspace()}
        </div>
    );
}
Cnc.propTypes = {
    // ...withRouter,
    // shouldShowJobType: PropTypes.bool,
    location: PropTypes.object
};
export default withRouter(Cnc);
