import { message } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { Trans } from 'react-i18next';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useHistory, withRouter } from 'react-router-dom';

import { HEAD_CNC } from '../../../constants';
import { actions as cncActions } from '../../../flux/cnc';
import { actions as editorActions } from '../../../flux/editor';
import { actions as machineActions } from '../../../flux/machine';
import { actions as projectActions } from '../../../flux/project';
import i18n from '../../../lib/i18n';
import modal from '../../../lib/modal';
import { getUploadModeByFilename } from '../../../lib/units';
import {
    SnapmakerA150Machine,
    SnapmakerA250Machine,
    SnapmakerA350Machine,
    SnapmakerArtisanMachine,
    SnapmakerOriginalExtendedMachine,
    SnapmakerOriginalMachine
} from '../../../machines';
import { machineStore } from '../../../store/local-storage';
import { Button } from '../../components/Buttons';
import Checkbox from '../../components/Checkbox';
import Dropzone from '../../components/Dropzone';
import Space from '../../components/Space';
import Steps from '../../components/Steps';
import SvgIcon from '../../components/SvgIcon';
import ProjectLayout from '../../layouts/ProjectLayout';
import { logPageView, renderModal, renderPopup, useUnsavedTitle } from '../../utils';
import CNCVisualizer from '../../widgets/CNCVisualizer';
import Thumbnail from '../../widgets/CncLaserShared/Thumbnail';
import useRenderMainToolBar from '../CncLaserShared/MainToolBar';
import RenderProjectRightView from '../CncLaserShared/ProjectRightView';
import useRenderRemoveModelsWarning from '../CncLaserShared/RemoveAllModelsWarning';
import HomePage from '../HomePage';
import Workspace from '../Workspace';
import {
    cnc4AxisStepOne,
    laserCncIntroStepFive,
    laserCncIntroStepOne,
    laserCncIntroStepSix,
    laserCncIntroStepTwo,
} from '../introContent';
import JobSetupModal from './modals/JobSetupModal';

const ACCEPT = '.svg, .png, .jpg, .jpeg, .bmp, .dxf, .stl, .3mf, .amf';
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
                    type={['static']}
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

interface CNCMainPageProps {
    location: {
        state: {
            shouldShowGuideTours?: boolean;
        };
    };
}

const Cnc: React.FC<CNCMainPageProps> = ({ location }) => {
    const widgets = useSelector(state => state?.widget[pageHeadType]?.default?.widgets, shallowEqual);
    const [isDraggingWidget, setIsDraggingWidget] = useState(false);
    const [showHomePage, setShowHomePage] = useState(false);
    const [showWorkspace, setShowWorkspace] = useState(false);
    const [showJobType, setShowJobType] = useState(true);
    const [enabledIntro, setEnabledIntro] = useState(null);
    const initIndex = 0;

    const toolPaths = useSelector(state => state[HEAD_CNC]?.toolPathGroup?.getToolPaths(), shallowEqual);
    const toolPathGroup = useSelector(state => state[HEAD_CNC]?.toolPathGroup, shallowEqual);
    const materials = useSelector(state => state[HEAD_CNC]?.materials, shallowEqual);

    const projectFileOversize = useSelector(state => state[HEAD_CNC]?.projectFileOversize, shallowEqual);
    const [isRotate, setIsRotate] = useState(materials?.isRotate);
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
            const uploadMode = getUploadModeByFilename(file.name);
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
                cancelTitle: i18n._('key-Workspace/WorkflowControl-Close'),
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
                    path: './UserCase/cnc/a250_standard/cnc_4th_a250a350_chess.snapcnc',
                    name: 'cnc_4th_a250a350_chess.snapcnc'
                };
            } else {
                switch (series) {
                    case SnapmakerOriginalMachine.identifier:
                    case SnapmakerOriginalExtendedMachine.identifier:
                        pathConfig = {
                            path: './UserCase/cnc/original_standard/cnc_original_standard.snapcnc',
                            name: 'cnc_original_standard.snapcnc'
                        };
                        break;
                    case SnapmakerA150Machine.identifier:
                        pathConfig = {
                            path: './UserCase/cnc/a150_standard/cnc_a150_standard.snapcnc',
                            name: 'cnc_a150_standard.snapcnc'
                        };
                        break;
                    case SnapmakerA250Machine.identifier:
                        pathConfig = {
                            path: './UserCase/cnc/a250_standard/cnc_a250_standard.snapcnc',
                            name: 'cnc_a250_standard.snapcnc'
                        };
                        break;
                    case SnapmakerA350Machine.identifier:
                        pathConfig = {
                            path: './UserCase/cnc/a350_standard/cnc_a350_standard.snapcnc',
                            name: 'cnc_a350_standard.snapcnc'
                        };
                        break;
                    case SnapmakerArtisanMachine.identifier:
                        pathConfig = {
                            path: './UserCase/cnc/Luban Lock.snapcnc',
                            name: 'Luban Lock.snapcnc',
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

    const renderStep = () => {
        const stepArr = [
            {
                intro: isRotate ? cnc4AxisStepOne(
                    i18n._('key-Cnc/Page-Set the work size and where the work origin will be.'),
                    i18n._('key-Cnc/Page-D is the diameter of the material,  and L is the length of the material.'),
                    i18n._('key-Cnc/Page-Origin is fixed at the center of the cross-section of the cylinder, far way from the chuck.')
                ) : laserCncIntroStepOne(
                    i18n._('key-Cnc/Page-Set the work size and where the work origin will be.'),
                    i18n._('key-Cnc/Page-X is the width of the material,  and Y is the height of the material.'),
                    i18n._('There are two types of origin mode.'),
                    i18n._('In object origin mode, the origin is at the corners or center of the object.'),
                    i18n._('In workpiece origin mode, the origin is at the corners or center of the workpiece.'),
                    i18n._('This point (X0, Y0) is the origin of the design coordinate system, and the origin to be positioned or set on the machine needs to coincide with this point.'),
                    null,
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
                element: '.widget-list-intro',
                title: `${i18n._('key-Cnc/Page-Edit Panel')} (4/8)`,
                intro: laserCncIntroStepTwo(i18n._('key-Cnc/Page-The Edit panel shows the property related to object. When an object is selected, Luban displays this panel where you can transform the object, switch the Processing Mode, or enter the Process Panel.')),
                disableInteraction: true,
                tooltipClass: 'cnc-edit-panel-intro',
                position: 'left'
            }, {
                element: '.widget-list-intro',
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
        ];
        return stepArr;
    };

    return (
        <div>
            <ProjectLayout
                renderMainToolBar={renderMainToolBar}
                renderRightView={
                    () => (
                        <RenderProjectRightView
                            headType={HEAD_CNC}
                            page={page}
                            widgets={widgets}
                            listActions={listActions}
                        />
                    )
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
                            steps={renderStep()}
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
                    dispatch(editorActions.updateState(HEAD_CNC, {
                        projectFileOversize: false
                    }))
                ),
                key: HEAD_CNC
            })}
            {warningModal}
            {removeModelsWarningModal}
            {/* Job Setup: Workpiece & Origin */
                showJobType && (
                    <JobSetupModal
                        onClose={() => setShowJobType(false)}
                    />
                )
            }
            {renderStlModal()}
            {renderHomepage()}
            {renderWorkspace()}
        </div>
    );
};

export default withRouter(Cnc);
