import { message } from 'antd';
import path from 'path';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { withRouter } from 'react-router-dom';

import { HEAD_LASER, PROCESS_MODE_GREYSCALE, PROCESS_MODE_VECTOR } from '../../../constants';
import { actions as editorActions } from '../../../flux/editor';
import { RootState } from '../../../flux/index.def';
import { actions as laserActions } from '../../../flux/laser';
import useSetState from '../../../lib/hooks/set-state';
import i18n from '../../../lib/i18n';
import modal from '../../../lib/modal';
import { machineStore } from '../../../store/local-storage';
import Dropzone from '../../components/Dropzone';
import ProjectLayout from '../../layouts/ProjectLayout';
import { logPageView, renderModal, renderPopup, useUnsavedTitle } from '../../utils';
import Thumbnail from '../../widgets/CncLaserShared/Thumbnail';
import StackedModel from '../../widgets/LaserStackedModel';
import LaserVisualizer from '../../widgets/LaserVisualizer';
import renderJobTypeModal from '../CncLaserShared/JobTypeModal';
import useRenderMainToolBar from '../CncLaserShared/MainToolBar';
import useRenderRemoveModelsWarning from '../CncLaserShared/RemoveAllModelsWarning';
import renderRightView from '../CncLaserShared/RightView';
import HomePage from '../HomePage';
import Workspace from '../Workspace';
import StarterGuide from './StarterGuide';

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
    const [stackedModelModalDsiabled, setStackedModelModalDsiabled] = useState(false);
    const [isDraggingWidget, setIsDraggingWidget] = useState(false);
    const [showHomePage, setShowHomePage] = useState(false);
    const [showWorkspace, setShowWorkspace] = useState(false);
    const [showJobType, setShowJobType] = useState(true);
    const [enabledIntro, setEnabledIntro] = useState(null);
    const coordinateMode = useSelector(state => state[HEAD_LASER]?.coordinateMode, shallowEqual);
    const coordinateSize = useSelector(state => state[HEAD_LASER]?.coordinateSize, shallowEqual);
    const toolPaths = useSelector(state => state[HEAD_LASER]?.toolPathGroup?.getToolPaths(), shallowEqual);
    const materials = useSelector(state => state[HEAD_LASER]?.materials, shallowEqual);
    const series = useSelector((state: RootState) => state.machine.series, shallowEqual);
    const page = useSelector(state => state[HEAD_LASER]?.page, shallowEqual);
    const projectFileOversize = useSelector(state => state[HEAD_LASER]?.projectFileOversize, shallowEqual);
    const [isRotate, setIsRotate] = useState(materials?.isRotate);
    const [jobTypeState, setJobTypeState] = useSetState({
        coordinateMode,
        coordinateSize,
        materials
    });
    const dispatch = useDispatch();
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

    const {
        setBackgroundModal,
        renderMainToolBar
    } = useRenderMainToolBar({
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
    const jobTypeModal = renderJobTypeModal(
        HEAD_LASER,
        dispatch,
        showJobType,
        setShowJobType,
        jobTypeState,
        setJobTypeState,
        coordinateMode,
        coordinateSize,
        materials,
    );
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

    const handleExit = useCallback(() => {
        setEnabledIntro(false);
    }, []);

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
                    {
                        enabledIntro && (
                            <StarterGuide
                                machineIdentifer={series}
                                isRotate={isRotate}
                                toolPaths={toolPaths}
                                onClose={handleExit}
                            />
                        )
                    }
                </Dropzone>
                <Thumbnail
                    ref={thumbnail}
                    toolPathGroup={toolPathGroup}
                />
            </ProjectLayout>
            {
                projectFileOversize && message.info({
                    content: <span>{i18n._('key-Laser/Page-Project file oversize')}</span>,
                    duration: 5,
                    onClose: () => (
                        dispatch(editorActions.updateState(pageHeadType, {
                            projectFileOversize: false
                        }))
                    ),
                    key: pageHeadType
                })
            }
            {warningRemovingModels}
            {jobTypeModal}
            {setBackgroundModal}
            {renderHomepage()}
            {renderWorkspace()}
            {renderStackedModelModal()}
        </div>
    );
};

LaserMainPage.propTypes = {
    // history: PropTypes.object
    location: PropTypes.object
};

export default withRouter(LaserMainPage);
