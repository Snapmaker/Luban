import { Machine } from '@snapmaker/luban-platform';
import { message } from 'antd';
import i18next from 'i18next';
import { includes } from 'lodash';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import { HEAD_CNC, HEAD_LASER, PROCESS_MODE_GREYSCALE, PROCESS_MODE_VECTOR, longLangWithType } from '../../../constants';
import { getMachineToolOptions } from '../../../constants/machines';
import { actions as editorActions } from '../../../flux/editor';
import { RootState } from '../../../flux/index.def';
import { actions as laserActions } from '../../../flux/laser';
import { actions as projectActions } from '../../../flux/project';
import { ConnectionType } from '../../../flux/workspace/state';
import i18n from '../../../lib/i18n';
import { SnapmakerOriginalExtendedMachine, SnapmakerOriginalMachine } from '../../../machines';
import { calculateElemsBoundingbox, handleClipPath, handleMask } from '../../SVGEditor/lib/ImageSvgCompose';
import Dropdown from '../../components/Dropdown';
import Menu from '../../components/Menu';
import ModalSmall from '../../components/Modal/ModalSmall';
import SvgIcon from '../../components/SvgIcon';
import MainToolBar from '../../layouts/MainToolBar';
import { renderModal } from '../../utils';
import Cnc3DVisualizer from '../../views/Cnc3DVisualizer';
import LaserCameraAndBackground from '../../widgets/LaserCameraAidBackground';
import MaterialThicknessInput from '../../widgets/LaserCameraAidBackground/MaterialThicknessInput';
import SelectCaptureMode, { MODE_THICKNESS_COMPENSATION } from '../../widgets/LaserCameraAidBackground/SelectCaptureMode';
import LaserSetBackground from '../../widgets/LaserSetBackground';

function useRenderMainToolBar({ headType, setShowHomePage, setShowJobType, setShowWorkspace, onChangeSVGClippingMode }) {
    const size = useSelector((state: RootState) => state.machine?.size);
    const unSaved = useSelector((state: RootState) => state.project[headType]?.unSaved, shallowEqual);
    const isRotate = useSelector(state => state[headType]?.materials?.isRotate, shallowEqual);
    const modelGroup = useSelector(state => state[headType]?.modelGroup, shallowEqual);

    const canRedo = useSelector(state => state[headType]?.history?.canRedo, shallowEqual);
    const canUndo = useSelector(state => state[headType]?.history?.canUndo, shallowEqual);

    // Machine
    const machineSeries = useSelector(state => state?.machine?.series);
    const machineToolHead = useSelector(state => state?.machine?.toolHead);

    const activeMachine: Machine = useSelector((state: RootState) => state.machine.activeMachine);

    // Workspace
    const {
        machineIdentifier: connectedMachineIdentifier,
        headType: workspaceHeadType,
        toolHead: workspaceToolHead,
        isRotate: workspaceIsRotate,
    } = useSelector((state: RootState) => state.workspace);

    const dispatch = useDispatch();

    const [machineInfo, setMachineInfo] = useState({
        series: machineSeries,
        toolHead: machineToolHead[`${headType}Toolhead`]
    });

    // Laser
    const { connectionType, isConnected } = useSelector(state => state.workspace, shallowEqual);
    const LaserSelectedModelArray = useSelector(state => state[HEAD_LASER]?.modelGroup?.selectedModelArray);
    const models = useSelector(state => state[headType]?.modelGroup?.models);
    const [currentAdjustedTargetModel, setCurrentAdjustedTargetModel] = useState(null);
    const SVGActions = useSelector(state => state[headType]?.SVGActions);


    const [cameraCaptureInfo, setCameraCaptureInfo] = useState({
        display: false,
        mode: '',
        materialThickness: null
    });
    const setShowCameraCapture = (show) => {
        modelGroup.unselectAllModels();
        dispatch(editorActions.clearSelection(headType));
        setCameraCaptureInfo({
            display: show,
            mode: '',
            materialThickness: null
        });
    };
    const isOriginalSeries = includes([SnapmakerOriginalMachine.identifier, SnapmakerOriginalExtendedMachine.identifier], activeMachine?.identifier);

    // set result image position and size
    const onChangeLogicalX = (newLogicalX) => {
        const elements = SVGActions.getSelectedElements();
        const newX = newLogicalX + size.x;
        dispatch(editorActions.moveElementsImmediately(headType, elements, { newX }));
    };
    const onChangeLogicalY = (newLogicalY) => {
        const elements = SVGActions.getSelectedElements();
        const newY = -newLogicalY + size.y;
        dispatch(editorActions.moveElementsImmediately(headType, elements, { newY }));
    };
    const onChangeWidth = (newWidth, width, height, scaleX, scaleY) => {
        const transformation = modelGroup.getSelectedModelTransformation();
        const elements = SVGActions.getSelectedElements();

        if (elements.length === 1) {
            if (transformation.uniformScalingState) {
                const newHeight = height * Math.abs(scaleY) * (newWidth / width / Math.abs(scaleX));
                dispatch(editorActions.resizeElementsImmediately(headType, elements, { newWidth, newHeight }));
            } else {
                dispatch(editorActions.resizeElementsImmediately(headType, elements, { newWidth }));
            }
        }
    };
    useEffect(() => {
        if (currentAdjustedTargetModel) {
            setCurrentAdjustedTargetModel(null);
            setTimeout(() => {
                const { width, height, scaleX, scaleY } = SVGActions?.getSelectedElementsTransformation();
                currentAdjustedTargetModel.width && onChangeWidth(currentAdjustedTargetModel.width || 0, width, height, scaleX, scaleY);
                onChangeLogicalX(currentAdjustedTargetModel.x || 0);
                onChangeLogicalY(currentAdjustedTargetModel.y || 0);
            }, 0);
        }
    }, [models]);

    // cnc
    const selectedModelArray = useSelector(state => state?.cnc?.modelGroup?.selectedModelArray);
    const selectedAllStl = selectedModelArray.length > 0 && selectedModelArray.every((model) => {
        return model.sourceType === 'image3d';
    });

    useEffect(() => {
        setMachineInfo({
            series: activeMachine?.identifier,
            toolHead: machineToolHead[`${headType}Toolhead`]
        });
    }, [activeMachine, machineToolHead, headType]);

    const [showStlModal, setShowStlModal] = useState(true);
    function handleHideStlModal() {
        setShowStlModal(false);
    }
    function handleShowStlModal() {
        setShowStlModal(true);
    }

    const leftItems = [
        {
            title: i18n._('key-CncLaser/MainToolBar-Home'),
            type: 'button',
            name: 'MainToolbarHome',
            action: async () => {
                await dispatch(editorActions.onRouterWillLeave(headType));
                setShowHomePage(true);
            }
        },
        {
            title: i18n._('key-CncLaser/MainToolBar-Workspace'),
            type: 'button',
            name: 'MainToolbarWorkspace',
            action: async () => {
                await dispatch(editorActions.onRouterWillLeave(headType));
                setShowWorkspace(true);
            }
        },
        {
            type: 'separator'
        },
        {
            title: i18n._('key-CncLaser/MainToolBar-Save'),
            disabled: !unSaved,
            type: 'button',
            name: 'MainToolbarSave',
            iconClassName: 'cnc-laser-save-icon',
            action: () => {
                dispatch(projectActions.save(headType));
            }
        },
        {
            title: i18n._('key-CncLaser/MainToolBar-Undo'),
            disabled: !canUndo,
            type: 'button',
            name: 'MainToolbarUndo',
            action: () => {
                dispatch(editorActions.undo(headType));
            }
        },
        {
            title: i18n._('key-CncLaser/MainToolBar-Redo'),
            disabled: !canRedo,
            type: 'button',
            name: 'MainToolbarRedo',
            action: () => {
                dispatch(editorActions.redo(headType));
            }
        },
        {
            title: i18n._('key-CncLaser/MainToolBar-Job Setup'),
            type: 'button',
            name: 'MainToolbarJobSetup',
            action: () => {
                setShowJobType(true);
            }
        },
        {
            type: 'separator'
        },
        {
            title: i18n._('key-CncLaser/MainToolBar-Top'),
            type: 'button',
            name: 'MainToolbarTop',
            action: () => {
                dispatch(editorActions.bringSelectedModelToFront(headType));
            }
        },
        {
            title: i18n._('key-CncLaser/MainToolBar-Bottom'),
            type: 'button',
            name: 'MainToolbarBottom',
            action: () => {
                dispatch(editorActions.sendSelectedModelToBack(headType));
            }
        },

    ];

    // operation tools
    leftItems.push(
        {
            type: 'separator',
        },
        {
            title: i18n._('key-CncLaser/MainToolBar-Vector Tool'),
            type: 'button',
            disabled: headType !== 'laser',
            name: 'ToolVector',
            action: () => {
                dispatch(onChangeSVGClippingMode);
            }
        },
    );

    // Laser specific tools
    if (headType === HEAD_LASER && !isRotate) {
        const cameraCaptureEnabled = (() => {
            if (isOriginalSeries) {
                return false;
            }

            return isConnected && connectionType === ConnectionType.WiFi;
        })();

        const cameraCaptureMenu = (
            <Menu>
                <Menu.Item
                    onClick={() => setShowCameraCapture(true)}
                    disabled={!cameraCaptureEnabled}
                >
                    <div className="align-l width-168">
                        <SvgIcon
                            type={['static']}
                            disabled={!cameraCaptureEnabled}
                            name="MainToolbarAddBackground"
                        />
                        <span
                            className="margin-left-4 height-24 display-inline"
                        >
                            {i18n._('key-CncLaser/MainToolBar-Add Background')}
                        </span>
                    </div>
                </Menu.Item>
                <Menu.Item
                    onClick={() => dispatch(laserActions.removeBackgroundImage())}
                >
                    <div className="align-l width-168">
                        <SvgIcon
                            type={['static']}
                            name="MainToolbarRemoverBackground"
                        />
                        <span
                            className="margin-left-4 height-24 display-inline"
                        >
                            {i18n._('key-CncLaser/MainToolBar-Remove Background')}
                        </span>
                    </div>
                </Menu.Item>
            </Menu>
        );

        leftItems.push(
            {
                title: i18n._('key-CncLaser/MainToolBar-Mask'),
                type: 'button',
                name: 'MainToolbarMask',
                action: async () => {
                    const svgs = LaserSelectedModelArray.filter(v => v.sourceType === 'svg' && v.mode === PROCESS_MODE_VECTOR);
                    const imgs = LaserSelectedModelArray.filter(v => v.sourceType !== 'svg' || v.mode === PROCESS_MODE_GREYSCALE);
                    if (svgs.length < 1 || imgs.length < 1) {
                        message.error(i18n._('Please select a vector and an image at the same time.'));
                        return;
                    }
                    const widthRatio = imgs[0].sourceWidth / imgs[0].width;
                    const { file: clipSvgTag, viewWidth } = await handleClipPath(svgs, imgs);
                    const bbox = calculateElemsBoundingbox(svgs);
                    setCurrentAdjustedTargetModel({
                        name: clipSvgTag.name,
                        x: bbox.viewboxX + bbox.viewWidth / 2 - size.x,
                        y: -(bbox.viewboxY + bbox.viewHeight / 2 - size.y),
                        width: viewWidth / widthRatio
                    });
                    dispatch(editorActions.uploadImage(HEAD_LASER, clipSvgTag, PROCESS_MODE_GREYSCALE, () => {
                        message.error(i18n._('Imgae create failed.'));
                    }, true));
                }
            },
            {
                title: i18n._('key-CncLaser/MainToolBar-Inverse Mask'),
                type: 'button',
                name: 'MainToolbarInversemask',
                action: async () => {
                    const svgs = LaserSelectedModelArray.filter(v => v.sourceType === 'svg' && v.mode === PROCESS_MODE_VECTOR);
                    const imgs = LaserSelectedModelArray.filter(v => v.sourceType !== 'svg' || v.mode === PROCESS_MODE_GREYSCALE);
                    if (svgs.length < 1 || imgs.length < 1) {
                        message.error(i18n._('Please select a vector and an image at the same time.'));
                        return;
                    }
                    const { file: maskSvgTag } = await handleMask(svgs, imgs);
                    const bbox = calculateElemsBoundingbox(imgs);
                    setCurrentAdjustedTargetModel({
                        name: maskSvgTag.name,
                        x: bbox.viewboxX + bbox.viewWidth / 2 - size.x,
                        y: -(bbox.viewboxY + bbox.viewHeight / 2 - size.y),
                        width: bbox.viewWidth
                    });
                    dispatch(editorActions.uploadImage(HEAD_LASER, maskSvgTag, PROCESS_MODE_GREYSCALE, () => {
                        message.error(i18n._('Imgae create failed.'));
                    }, true));
                }
            },
            {
                type: 'separator'
            },
        );

        // Camera Capture
        leftItems.push(
            {
                // MainToolbarCameraCapture
                type: 'render',
                customRender: () => {
                    const toolIdentifer = machineToolHead.laserToolhead;
                    const machineToolOptions = getMachineToolOptions(activeMachine?.identifier, toolIdentifer);
                    if (!machineToolOptions?.supportCameraCapture) {
                        return null;
                    }
                    return (
                        <Dropdown
                            className="display-inline align-c padding-horizontal-2 height-50"
                            overlay={cameraCaptureMenu}
                        >
                            <div
                                className="display-inline font-size-0 v-align-t hover-normal-grey-2 border-radius-4 padding-top-4"
                            >
                                <SvgIcon
                                    name="MainToolbarCameraCapture"
                                    type={['static']}
                                >
                                    <div className={`${includes(longLangWithType[i18next.language], headType) ? 'font-size-small' : 'font-size-base margin-top-4'} color-black-3 height-16`}>
                                        {i18n._('key-CncLaser/MainToolBar-Camera Capture')}
                                        <SvgIcon
                                            type={['static']}
                                            name="DropdownOpen"
                                            size={20}
                                        />
                                    </div>
                                </SvgIcon>
                            </div>
                        </Dropdown>
                    );
                }
            },
        );

        // Add shape repository
        leftItems.splice(2, 0,
            {
                title: i18n._('key-CncLaser/MainToolBar-ShapeRepository'),
                type: 'button',
                name: 'MainToolbarShapeRepository',
                action: () => {
                    dispatch(editorActions.updateEditorState({ showSVGShapeLibrary: true }));
                }
            },);
    }

    // CNC specific tools
    if (headType === HEAD_CNC) {
        const showStlMenu = (
            <Menu>
                <Menu.Item
                    onClick={handleShowStlModal}
                    disabled={showStlModal}
                >
                    <div className="align-l width-168">
                        <SvgIcon
                            type={['static']}
                            disabled={showStlModal}
                            name="MainToolbarAddBackground"
                        />
                        <span
                            className="margin-left-4 height-24 display-inline"
                        >
                            {i18n._('key-CncLaser/MainToolBar-Enable STL 3D View')}
                        </span>

                    </div>
                </Menu.Item>
                <Menu.Item
                    onClick={handleHideStlModal}
                    disabled={!showStlModal}
                >
                    <div className="align-l width-168">
                        <SvgIcon
                            type={['static']}
                            disabled={!showStlModal}
                            name="MainToolbarRemoverBackground"
                        />
                        <span
                            className="margin-left-4 height-24 display-inline"
                        >
                            {i18n._('key-CncLaser/MainToolBar-Disable STL 3D View')}
                        </span>
                    </div>
                </Menu.Item>
            </Menu>
        );

        leftItems.push(
            {
                title: i18n._('key-3DP/MainToolBar-Model repair'),
                disabled: !selectedAllStl,
                type: 'button',
                name: 'MainToolbarFixModel',
                action: () => {
                    dispatch(editorActions.repairSelectedModels(headType));
                }
            },
            {
                type: 'render',
                customRender: () => {
                    return (
                        <Dropdown
                            className="display-inline align-c padding-horizontal-2 height-50"
                            overlay={showStlMenu}
                        >
                            <div
                                className="display-inline font-size-0 v-align-t hover-normal-grey-2 border-radius-4 padding-top-4"
                            >
                                <SvgIcon
                                    name="MainToolbarStl3dView"
                                    type={['static']}
                                >
                                    <div className={`${includes(longLangWithType[i18next.language], headType) ? 'font-size-small' : 'font-size-base'} "color-black-3 height-16"`}>
                                        {i18n._('key-CncLaser/MainToolBar-STL 3D View')}
                                        <SvgIcon
                                            type={['static']}
                                            name="DropdownOpen"
                                            size={20}
                                        />
                                    </div>
                                </SvgIcon>
                            </div>
                        </Dropdown>
                    );
                }
            },
        );
    }


    const materialThickness = React.useRef(null);
    const setBackgroundModal = cameraCaptureInfo.display && (() => {
        const modalConfig = {
            title: '',
            shouldRenderFooter: true,
            actions: []
        };
        const content = (() => {
            // Original only support select background manually
            if (isOriginalSeries) {
                return (
                    <div>
                        <LaserSetBackground
                            hideModal={() => {
                                setShowCameraCapture(false);
                            }}
                        />
                    </div>
                );
            }

            // If selected machine and tool, not matching the machine connected
            if ((connectedMachineIdentifier !== machineSeries
                || workspaceHeadType !== HEAD_LASER
                || machineToolHead.laserToolhead !== workspaceToolHead
                || workspaceIsRotate)) {
                return (
                    <ModalSmall
                        title={i18n._('key-Laser/CameraCapture-diff_setting_error')}
                        text={i18n._('key-Laser/CameraCapture-diff_setting_error_info')}
                        img="WarningTipsWarning"
                        iconColor="#FFA940"
                        onClose={() => { setShowCameraCapture(false); }}
                    />
                );
            }

            if (!cameraCaptureInfo.mode) {
                modalConfig.title = i18n._('key-Laser/CameraCapture-Camera Capture');
                modalConfig.shouldRenderFooter = false;
                return (
                    <SelectCaptureMode
                        series={machineInfo.series}
                        onSelectMode={(mode) => {
                            setCameraCaptureInfo((pre) => {
                                return {
                                    ...pre,
                                    mode
                                };
                            });
                        }}
                    />
                );
            }

            if (cameraCaptureInfo.mode === MODE_THICKNESS_COMPENSATION && cameraCaptureInfo.materialThickness === null) {
                modalConfig.title = i18n._('key-Laser/CameraCapture-Camera Capture');
                modalConfig.actions = [{
                    name: i18n._('key-Modal/Common-Next'),
                    isPrimary: true,
                    onClick: () => {
                        setCameraCaptureInfo((pre) => {
                            return {
                                ...pre,
                                materialThickness: materialThickness.current
                            };
                        });
                    }
                }];
                modalConfig.shouldRenderFooter = true;
                return (
                    <MaterialThicknessInput
                        series={machineInfo.series}
                        onChange={(v) => {
                            materialThickness.current = v;
                        }}
                    />
                );
            } else {
                return (
                    <LaserCameraAndBackground
                        mode={cameraCaptureInfo.mode}
                        materialThickness={cameraCaptureInfo.materialThickness}
                        hideModal={() => {
                            setShowCameraCapture(false);
                        }}
                    />
                );
            }
        })();

        return renderModal({
            title: modalConfig.title,
            shouldRenderFooter: modalConfig.shouldRenderFooter,
            actions: modalConfig.actions,
            renderBody() {
                return content;
            },
            onClose: () => { setShowCameraCapture(false); }
        });
    })();
    const renderStlModal = () => {
        return (
            <Cnc3DVisualizer show={showStlModal} />
        );
    };

    return {
        renderStlModal, // cnc
        setBackgroundModal, // laser
        renderMainToolBar: () => {
            return (
                <MainToolBar
                    leftItems={leftItems}
                    lang={i18next.language}
                    headType={headType}
                    // machineInfo={machineInfo}
                    isConnected={isConnected}
                />
            );
        }
    };
}
useRenderMainToolBar.propTypes = {
    headType: PropTypes.string.isRequired,
    setShowHomePage: PropTypes.func,
    setShowJobType: PropTypes.func,
    setShowWorkspace: PropTypes.func
};

export default useRenderMainToolBar;
