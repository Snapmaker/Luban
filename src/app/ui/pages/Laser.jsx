import React, { useState, useEffect, useRef } from 'react';
import { shallowEqual, useSelector, useDispatch } from 'react-redux';
import path from 'path';
// import PropTypes from 'prop-types';
import { useHistory, useLocation } from 'react-router-dom';
import 'intro.js/introjs.css';
import { message } from 'antd';
import i18n from '../../lib/i18n';
import useSetState from '../../lib/hooks/set-state';
import modal from '../../lib/modal';
import LaserVisualizer from '../widgets/LaserVisualizer';

import { renderPopup, logPageView, useUnsavedTitle, renderModal } from '../utils';
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
import StackedModel from '../widgets/LaserStackedModel';
import Modal from '../components/Modal';
import { Button } from '../components/Buttons';

const ACCEPT = '.svg, .png, .jpg, .jpeg, .bmp, .dxf';
const pageHeadType = HEAD_LASER;

function Laser() {
    const widgets = useSelector(state => state?.widget[pageHeadType]?.default?.widgets, shallowEqual);
    const showImportStackedModelModal = useSelector(state => state[pageHeadType].showImportStackedModelModal, shallowEqual);
    const [stackedModelModalDsiabled, setStackedModelModalDsiabled] = useState(false);
    const [isDraggingWidget, setIsDraggingWidget] = useState(false);
    const [showHomePage, setShowHomePage] = useState(false);
    const [showWorkspace, setShowWorkspace] = useState(false);
    const [showJobType, setShowJobType] = useState(true);
    const [enabledIntro, setEnabledIntro] = useState(null);
    const location = useLocation();
    const initIndex = 0;
    const coordinateMode = useSelector(state => state[HEAD_LASER]?.coordinateMode, shallowEqual);
    const coordinateSize = useSelector(state => state[HEAD_LASER]?.coordinateSize, shallowEqual);
    const toolPaths = useSelector(state => state[HEAD_LASER]?.toolPathGroup?.getToolPaths(), shallowEqual);
    const materials = useSelector(state => state[HEAD_LASER]?.materials, shallowEqual);
    const series = useSelector(state => state.machine.series, shallowEqual);
    const page = useSelector(state => state[HEAD_LASER]?.page, shallowEqual);
    const projectFileOversize = useSelector(state => state[HEAD_LASER]?.projectFileOversize, shallowEqual);
    const [isRotate, setIsRotate] = useState(materials?.isRotate);
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
        setIsRotate(!!location?.state?.isRotate);
    }, [location?.state?.isRotate]);

    useEffect(() => {
        setShowJobType(!!location?.state?.shouldShowJobType);
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
            const extname = path.extname(file.name).toLowerCase();
            if (extname === '.svg' || extname === '.dxf') {
                mode = PROCESS_MODE_VECTOR;
            }
            if (extname === '.stl' || extname === '.3mf' || extname === '.amf') {
                dispatch(editorActions.cutModel(HEAD_LASER, file, () => {
                    modal({
                        cancelTitle: i18n._('key-Laser/Page-Close'),
                        title: i18n._('key-Laser/Page-Import Error'),
                        body: i18n._('Failed to import this object. \nPlease select a supported file format.')
                    });
                }));
            } else {
                dispatch(editorActions.uploadImage('laser', file, mode, () => {
                    modal({
                        cancelTitle: i18n._('key-Laser/Page-Close'),
                        title: i18n._('key-Laser/Page-Import Error'),
                        body: i18n._('Failed to import this object. \nPlease select a supported file format.')
                    });
                }));
            }
        },
        onDropRejected: () => {
            modal({
                title: i18n._('key-Laser/Page-Warning'),
                cancelTitle: i18n._('key-Workspace/WorkflowControl-Close'),
                body: i18n._('key-Laser/Page-Only {{accept}} files are supported.', { accept: ACCEPT })
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
    function renderStackedModelModal() {
        const onClose = () => {
            dispatch(editorActions.updateState(pageHeadType, {
                showImportStackedModelModal: false
            }));
        };
        return showImportStackedModelModal && renderModal({
            title: i18n._('key-StackedModel/Import-Preview Stacked Model'),
            onClose,
            renderBody: () => (<StackedModel setStackedModelModalDsiabled={setStackedModelModalDsiabled} />),
            actions: [
                {
                    name: i18n._('key-StackedModel/Import-Cancel'),
                    onClick: () => {
                        dispatch(editorActions.cancelCutModel());
                        onClose();
                    }
                },
                {
                    name: i18n._('key-StackedModel/Import-Import'),
                    isPrimary: true,
                    disabled: stackedModelModalDsiabled,
                    onClick: () => {
                        dispatch(editorActions.importStackedModelSVG(HEAD_LASER));
                        onClose();
                    }
                }
            ]
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
                            path: './UserCase/laser/a250_1600mw/laser_4th_a250a350_1600mW.snaplzr',
                            name: 'laser_4th_a250a350_1600mW.snaplzr'
                        };
                        break;
                    default:
                        pathConfig = {
                            path: './UserCase/laser/a350_1600mw/laser_4th_a250a350_1600mW.snaplzr',
                            name: 'laser_4th_a250a350_1600mW.snaplzr'
                        };
                        break;
                }
            } else {
                switch (series) {
                    case 'Original Long Z-axis':
                    case 'Original':
                        pathConfig = {
                            path: './UserCase/laser/original_200mw/laser_original_200mW.snaplzr',
                            name: 'laser_original_200mW.snaplzr'
                        };
                        break;
                    case 'A150':
                        pathConfig = {
                            path: './UserCase/laser/a150_1600mw/laser_a150_1600mW.snaplzr',
                            name: 'laser_a150_1600mW.snaplzr'
                        };
                        break;
                    case 'A250':
                        pathConfig = {
                            path: './UserCase/laser/a250_1600mw/laser_a250_1600mW.snaplzr',
                            name: 'laser_a250_1600mW.snaplzr'
                        };
                        break;
                    case 'A350':
                        pathConfig = {
                            path: './UserCase/laser/a350_1600mw/laser_a350_1600mW.snaplzr',
                            name: 'laser_a350_1600mW.snaplzr'
                        };
                        break;
                    default:
                        pathConfig = {
                            path: './UserCase/laser/original_200mw/laser_original_200mW.snaplzr',
                            name: 'laser_original_200mW.snaplzr'
                        };
                        break;
                }
            }
            dispatch(projectActions.openProject(pathConfig, history, true, true));
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
    const renderStep = () => {
        const stepArr = [{
            intro: isRotate ? laser4AxisStepOne(
                i18n._('key-Laser/Page-Set the work size and where the work origin will be.'),
                i18n._('key-Laser/Page-D is the diameter of the material,  and L is the length of the material.'),
                i18n._('key-Laser/Page-Origin is fixed at the edge of the cross-section of the cylinder, far way from the chuck.')
            ) : laserCncIntroStepOne(
                i18n._('key-Laser/Page-Set the work size and where the work origin will be.'),
                i18n._('key-Laser/Page-X is the width of the material,  and Y is the height of the material.'),
                i18n._('key-Laser/Page-Origin can be set at any corner or the middle of the job. This point (X0, Y0) is the origin of the design coordinate system. It also represents the origin of the workpiece coordinate system that you should set on the material using the machine tool.')
            ),
            title: `${i18n._('key-Laser/Page-Job Setup')} (1/8)`
        }, {
            element: '.laser-tool-bar-open-icon',
            title: `${i18n._('key-Laser/Page-Import Object')} (2/8)`,
            intro: laserCncIntroStepTwo(i18n._('key-Laser/Page-Import an object, or drag an object to Luban.')),
            disableInteraction: true,
            tooltipClass: 'laser-import-intro',
            position: 'right'
        }, {
            element: '.laser-draw-intro-part',
            title: `${i18n._('key-Laser/Page-Draw Object')} (3/8)`,
            intro: laserCncIntroStepTwo(i18n._('key-Laser/Page-Alternatively, you can draw simple objects or add text for laser engrave or CNC carve.')),
            disableInteraction: true,
            tooltipClass: 'laser-draw-intro',
            position: 'right'
        }, {
        // element: '.laser-intro-edit-panel',
            element: '.widget-list-intro',
            title: `${i18n._('key-Laser/Page-Edit Panel')} (4/8)`,
            intro: laserCncIntroStepTwo(i18n._('key-Laser/Page-The Edit panel shows the property related to object. When an object is selected, Luban displays this panel where you can transform the object, switch the Processing Mode, or enter the Process Panel.')),
            disableInteraction: true,
            tooltipClass: 'laser-edit-panel-intro',
            position: 'left'
        }, {
            element: '.laser-widget-list-intro',
            title: `${i18n._('key-Laser/Page-Process Panel')} (5/8)`,
            intro: laserCncIntroStepFive(
                i18n._('key-Laser/Page-The Process panel shows the Toolpath List and the relevant property of the toolpath.'),
                i18n._('key-Laser/Page-After the selected object is edited, click Create Toolpath to create a toolpath of the object. Below the Toolpath List are the parameters you often use.'),
                i18n._('key-Laser/Page-Create Toolpath')
            ),
            disableInteraction: true,
            position: 'left'
        }, {
            element: '.laser-preview-export-intro-part',
            title: `${i18n._('key-Laser/Page-Generate G-code and Preview')} (6/8)`,
            position: 'top',
            disableInteraction: true,
            intro: laserCncIntroStepSix(
                i18n._('key-Laser/Page-Click to generate and preview the G-code file.'),
                i18n._('key-Laser/Page-For laser engraving, you can preview the toolpath. For CNC carving, you can preview the toolpath and simulate the operation result.'),
                // isRotate ? '/resources/images/guide-tours/laser_4_axis_priview.png' : '/resources/images/guide-tours/laser_3_axis_priview.png'
                isRotate,
                series,
                'laser'
            )
        }, {
            element: '.laser-preview-export-intro-part',
            title: `${i18n._('key-Laser/Page-Export')} (7/8)`,
            position: 'top',
            disableInteraction: true,
            intro: laserCncIntroStepTwo(
                i18n._('key-Laser/Page-Export the G-code file to a local device or load it to Workspace. Use Touchscreen or Luban to start laser engraving or CNC carving.')
            )
        }, {
            element: '.cnc-laser-save-icon',
            title: `${i18n._('key-Laser/Page-Save Project')} (8/8)`,
            position: 'bottom',
            disableInteraction: true,
            intro: laserCncIntroStepTwo(i18n._('key-Laser/Page-Save the project to a local device for reuse.'))
        }];
        return stepArr;
    };

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
                    accept={isRotate ? ACCEPT : `${ACCEPT}, .stl, .3mf, .amf`}
                    dragEnterMsg={i18n._('key-Laser/Page-Drop an image file here.')}
                    onDropAccepted={actions.onDropAccepted}
                    onDropRejected={actions.onDropRejected}
                >
                    <LaserVisualizer
                        widgetId="laserVisualizer"
                    />
                    {enabledIntro && (
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
                            steps={renderStep()}
                            onExit={handleExit}
                        />
                    )}
                </Dropzone>
                <Thumbnail
                    ref={thumbnail}
                    toolPathGroup={toolPathGroup}
                />
            </ProjectLayout>
            {projectFileOversize && message.info({
                content: <span>{i18n._('key-Laser/Page-Project file oversize')}</span>,
                duration: 5,
                onClose: () => (
                    dispatch(editorActions.updateState(pageHeadType, {
                        projectFileOversize: false
                    }))
                ),
                key: pageHeadType
            })}
            {warningRemovingModels}
            {jobTypeModal}
            {setBackgroundModal}
            {renderHomepage()}
            {renderWorkspace()}
            {renderStackedModelModal()}
        </div>
    );
}

function Guard() {
    const series = useSelector(state => state.machine.series, shallowEqual);

    const [hiddenMachineUpdate, setHiddenMachineUpdate] = useState((() => {
        if ((series === 'A150' || series === 'A250' || series === 'A350') && !machineStore.get('hiddenMachineUpdate')) {
            return false;
        } else {
            return true;
        }
    })());

    const onClose = () => {
        machineStore.set('hiddenMachineUpdate', true);

        setHiddenMachineUpdate(true);
    };

    return (
        <>
            {
                !hiddenMachineUpdate && (
                    <Modal
                        // 1000 larger than the Steps zindex
                        zIndex={100001000}
                        centered
                        onClose={onClose}
                    >
                        <Modal.Header>
                            <div className="width-432 text-overflow-ellipsis">{i18n._('key-Laser_firmware_update_title-Please Update Machine Firmware')}</div>
                        </Modal.Header>
                        <Modal.Body>
                            <div className="width-432">
                                {i18n._('key-Laser_firmware_update_content-Luban updated the parameters on the laser. This change requires the machine to be updated to version 1.13.4 or higher to adapt.')}
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button
                                priority="level-two"
                                className="align-r"
                                width="96px"
                                type="primary"
                                onClick={onClose}
                            >
                                { i18n._('key-Laser_firmware_ok-OK')}
                            </Button>
                        </Modal.Footer>
                    </Modal>
                )
            }
            <Laser />
        </>
    );
}

export default Guard;
