import path from 'path';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { withRouter } from 'react-router-dom';
import { Machine } from '@snapmaker/luban-platform';

import { HEAD_LASER, PROCESS_MODE_GREYSCALE, PROCESS_MODE_VECTOR } from '../../../constants';
import { actions as editorActions } from '../../../flux/editor';
import { RootState } from '../../../flux/index.def';
import { actions as laserActions } from '../../../flux/laser';
import i18n from '../../../lib/i18n';
import modal from '../../../lib/modal';
import { machineStore } from '../../../store/local-storage';
import Dropzone from '../../components/Dropzone';
import ProjectLayout from '../../layouts/ProjectLayout';
import { logPageView, renderModal, renderPopup, useUnsavedTitle } from '../../utils';
import Thumbnail from '../../widgets/CncLaserShared/Thumbnail';
import StackedModel from '../../widgets/LaserStackedModel';
import LaserVisualizer from '../../widgets/LaserVisualizer';
import useRenderMainToolBar from '../CncLaserShared/MainToolBar';
import useRenderRemoveModelsWarning from '../CncLaserShared/RemoveAllModelsWarning';
import RenderProjectRightView from '../CncLaserShared/ProjectRightView';
import HomePage from '../HomePage';
import Workspace from '../Workspace';
import StarterGuide from './StarterGuide';
import JobSetupModal from './modals/JobSetupModal';
import ProjectOversizeMessage from './modals/ProjectOversizeMessage';
import { SnapmakerRayMachine } from '../../../machines';
import { LaserWorkspaceRay } from '../laser-workspace-ray';
import { PageMode } from '../PageMode';

const ACCEPT = '.svg, .png, .jpg, .jpeg, .bmp, .dxf';
const pageHeadType = HEAD_LASER;

interface LaserMainPageProps {
    location: {
        state: {
            shouldShowGuideTours?: boolean;
        };
    };
}

const LaserMainPage: React.FC<LaserMainPageProps> = ({ location }) => {
    const widgets = useSelector((state: RootState) => state?.widget[pageHeadType]?.default?.widgets, shallowEqual);
    const showImportStackedModelModal = useSelector(state => state[pageHeadType].showImportStackedModelModal, shallowEqual);

    const toolPaths = useSelector(state => state[HEAD_LASER]?.toolPathGroup?.getToolPaths(), shallowEqual);
    const toolPathGroup = useSelector(state => state[HEAD_LASER]?.toolPathGroup, shallowEqual);
    useUnsavedTitle(pageHeadType);
    const page = useSelector(state => state[HEAD_LASER]?.page, shallowEqual);

    const activeMachine: Machine = useSelector((state: RootState) => state.machine.activeMachine);
    const toolHead: string = useSelector((state: RootState) => state.machine.toolHead, shallowEqual);
    const toolHeadIdentifier = toolHead.laserToolhead;

    // const series = useSelector((state: RootState) => state.machine.series, shallowEqual);
    const materials = useSelector(state => state[HEAD_LASER]?.materials, shallowEqual);
    const [isRotate, setIsRotate] = useState(materials?.isRotate);


    // state
    const [stackedModelModalDsiabled, setStackedModelModalDsiabled] = useState(false);
    const [isDraggingWidget, setIsDraggingWidget] = useState(false);

    // subview
    const [showHomePage, setShowHomePage] = useState(false);
    const [showWorkspace, setShowWorkspace] = useState(false);
    const [showJobType, setShowJobType] = useState(true);

    const [pageMode, setPageMode] = useState(PageMode.Default);

    const dispatch = useDispatch();

    const thumbnail = useRef();

    useEffect(() => {
        dispatch(laserActions.init());
        logPageView({
            pathname: '/laser',
        });
    }, []);

    useEffect(() => {
        setIsRotate(!!location?.state?.isRotate);
    }, [location?.state?.isRotate]);

    useEffect(() => {
        setShowJobType(!!location?.state?.shouldShowJobType);
    }, [location?.state?.shouldShowJobType]);

    // Starter Guide
    const [showStarterGuide, setShowStarterGuide] = useState(false);
    useEffect(() => {
        if (location?.state?.shouldShowGuideTours) {
            setShowStarterGuide(true);
        } else if (!location?.state?.shouldShowGuideTours && typeof (location?.state?.shouldShowGuideTours) === 'boolean') {
            setShowStarterGuide(false);
        }
    }, [location?.state?.shouldShowGuideTours]);

    useEffect(() => {
        if (typeof (showStarterGuide) === 'boolean' && !showStarterGuide) {
            machineStore.set(isRotate ? 'guideTours.guideTourslaser4Axis' : 'guideTours.guideTourslaser', true); // mock   ---> true
        }
    }, [showStarterGuide, isRotate]);

    // close starter guide
    const onStarterGuideClose = useCallback(() => {
        setShowStarterGuide(false);
    }, []);

    const onChangeSVGClippingMode = useCallback(() => {
        setPageMode(pageMode === PageMode.SVGClipping ? PageMode.Default : PageMode.SVGClipping);
    }, [pageMode]);

    const {
        setBackgroundModal,
        renderMainToolBar
    } = useRenderMainToolBar({
        headType: HEAD_LASER,
        setShowHomePage,
        setShowJobType,
        setShowWorkspace,
        onChangeSVGClippingMode
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

    /**
     * Render function of workspace.
     */
    const renderWorkspace = useCallback(() => {
        if (!showWorkspace) {
            return null;
        }

        const onClose = () => {
            setShowWorkspace(false);
        };

        let component = Workspace;
        if (activeMachine?.identifier === SnapmakerRayMachine.identifier) {
            component = LaserWorkspaceRay;
        }

        return renderPopup({
            onClose,
            component,
        });
    }, [showWorkspace, activeMachine?.identifier, isRotate]);

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

    return (
        <div>
            <ProjectLayout
                renderMainToolBar={renderMainToolBar}
                renderRightView={
                    () => (
                        <RenderProjectRightView
                            headType={HEAD_LASER}
                            page={page}
                            widgets={widgets}
                            listActions={listActions}
                        />
                    )
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
                        pageMode={pageMode}
                        setPageMode={setPageMode}
                    />
                    {
                        showStarterGuide && (
                            <StarterGuide
                                machineIdentifer={activeMachine?.identifier}
                                toolHeadIdentifier={toolHeadIdentifier}
                                isRotate={isRotate}
                                toolPaths={toolPaths}
                                onClose={onStarterGuideClose}
                            />
                        )
                    }
                </Dropzone>
                <Thumbnail
                    ref={thumbnail}
                    toolPathGroup={toolPathGroup}
                />
            </ProjectLayout>
            <ProjectOversizeMessage />
            {warningRemovingModels}
            {/* Job Setup: Workpiece & Origin */
                showJobType && (
                    <JobSetupModal
                        onClose={() => setShowJobType(false)}
                    />
                )
            }
            {setBackgroundModal}
            {renderHomepage()}
            {renderWorkspace()}
            {renderStackedModelModal()}
        </div>
    );
};

export default withRouter(LaserMainPage);
