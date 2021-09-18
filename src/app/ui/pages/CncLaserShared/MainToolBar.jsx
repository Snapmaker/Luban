import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import React, { useState } from 'react';
import Menu from '../../components/Menu';
import SvgIcon from '../../components/SvgIcon';
import i18n from '../../../lib/i18n';
import { actions as projectActions } from '../../../flux/project';
import { actions as editorActions } from '../../../flux/editor';
import Dropdown from '../../components/Dropdown';
import Cnc3DVisualizer from '../../views/Cnc3DVisualizer';
import MainToolBar from '../../layouts/MainToolBar';
import { HEAD_CNC, HEAD_LASER, MACHINE_SERIES } from '../../../constants';
import { actions as laserActions } from '../../../flux/laser';
import { renderModal } from '../../utils';
import LaserSetBackground from '../../widgets/LaserSetBackground';
import LaserCameraAidBackground from '../../widgets/LaserCameraAidBackground';

function useRenderMainToolBar({ headType, setShowHomePage, setShowJobType, setShowWorkspace }) {
    const unSaved = useSelector(state => state?.project[headType]?.unSaved, shallowEqual);
    const canRedo = useSelector(state => state[headType]?.history?.canRedo, shallowEqual);
    const canUndo = useSelector(state => state[headType]?.history?.canUndo, shallowEqual);
    const isRotate = useSelector(state => state[headType]?.materials?.isRotate, shallowEqual);

    // Laser
    const isConnected = useSelector(state => state?.machine?.isConnected, shallowEqual);
    const series = useSelector(state => state?.machine?.series, shallowEqual);
    const [showCameraCapture, setShowCameraCapture] = useState(false);
    const isOriginalSeries = (series === MACHINE_SERIES.ORIGINAL?.value || series === MACHINE_SERIES.ORIGINAL_LZ?.value);

    const [showStlModal, setShowStlModal] = useState(true);
    const dispatch = useDispatch();
    function handleHideStlModal() {
        setShowStlModal(false);
    }
    function handleShowStlModal() {
        setShowStlModal(true);
    }
    let menu;
    if (headType === HEAD_CNC) {
        menu = (
            <Menu style={{ marginTop: '8px' }}>
                <Menu.Item
                    onClick={handleShowStlModal}
                    disabled={showStlModal}
                >
                    <div className="align-l width-168">
                        <SvgIcon
                            type="static"
                            disabled={showStlModal}
                            name="MainToolbarAddBackground"
                        />
                        <span
                            className="margin-left-4 height-24 display-inline"
                        >
                            {i18n._('Enable STL 3D View')}
                        </span>

                    </div>
                </Menu.Item>
                <Menu.Item
                    onClick={handleHideStlModal}
                    disabled={!showStlModal}
                >
                    <div className="align-l width-168">
                        <SvgIcon
                            type="static"
                            disabled={!showStlModal}
                            name="MainToolbarRemoverBackground"
                        />
                        <span
                            className="margin-left-4 height-24 display-inline"
                        >
                            {i18n._('Disable STL 3D View')}
                        </span>
                    </div>
                </Menu.Item>
            </Menu>
        );
    } else if (headType === HEAD_LASER) {
        menu = (
            <Menu style={{ marginTop: '8px' }}>
                <Menu.Item
                    onClick={() => setShowCameraCapture(true)}
                    disabled={isOriginalSeries ? false : !isConnected}
                >
                    <div className="align-l width-168">
                        <SvgIcon
                            type={['static']}
                            disabled={isOriginalSeries ? false : !isConnected}
                            name="MainToolbarAddBackground"
                        />
                        <span
                            className="margin-left-4 height-24 display-inline"
                        >
                            {i18n._('Add Background')}
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
                            {i18n._('Remove Background')}
                        </span>
                    </div>
                </Menu.Item>
            </Menu>
        );
    }
    const leftItems = [
        {
            title: i18n._('Home'),
            type: 'button',
            name: 'MainToolbarHome',
            action: () => {
                setShowHomePage(true);
            }
        },
        {
            title: i18n._('Workspace'),
            type: 'button',
            name: 'MainToolbarWorkspace',
            action: () => {
                setShowWorkspace(true);
            }
        },
        {
            type: 'separator'
        },
        {
            title: i18n._('Save'),
            disabled: !unSaved,
            type: 'button',
            name: 'MainToolbarSave',
            iconClassName: 'cnc-save-icon',
            action: () => {
                dispatch(projectActions.save(headType));
            }
        },
        {
            title: i18n._('Undo'),
            disabled: !canUndo,
            type: 'button',
            name: 'MainToolbarUndo',
            action: () => {
                dispatch(editorActions.undo(headType));
            }
        },
        {
            title: i18n._('Redo'),
            disabled: !canRedo,
            type: 'button',
            name: 'MainToolbarRedo',
            action: () => {
                dispatch(editorActions.redo(headType));
            }
        },
        {
            title: i18n._('Job Setup'),
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
            title: i18n._('Top'),
            type: 'button',
            name: 'MainToolbarTop',
            action: () => {
                dispatch(editorActions.bringSelectedModelToFront(headType));
            }
        },
        {
            title: i18n._('Bottom'),
            type: 'button',
            name: 'MainToolbarBottom',
            action: () => {
                dispatch(editorActions.sendSelectedModelToBack(headType));
            }
        }
    ];
    if (headType === HEAD_CNC && isRotate) {
        leftItems.push(
            {
                type: 'separator'
            },
            {
                type: 'render',
                customRender: function () {
                    return (
                        <Dropdown
                            className="display-inline align-c padding-horizontal-2 height-50"
                            overlay={menu}
                        >
                            <div
                                className="display-inline font-size-0 v-align-t hover-normal-grey-2 border-radius-4 padding-top-4"
                            >
                                <SvgIcon
                                    name="MainToolbarStl3dView"
                                    type={['static']}
                                >
                                    <div className="font-size-base color-black-3 height-16 margin-top-4">
                                        {i18n._('STL 3D View')}
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
            }
        );
    }
    if (headType === HEAD_LASER && !isRotate) {
        leftItems.push(
            {
                type: 'separator'
            },
            {
                // MainToolbarCameraCapture
                type: 'render',
                customRender: function () {
                    return (
                        <Dropdown
                            className="display-inline align-c padding-horizontal-2 height-50"
                            overlay={menu}
                        >
                            <div
                                className="display-inline font-size-0 v-align-t hover-normal-grey-2 border-radius-4 padding-top-4"
                            >
                                <SvgIcon
                                    name="MainToolbarCameraCapture"
                                    type={['static']}
                                >
                                    <div className="font-size-base color-black-3 height-16 margin-top-4">
                                        {i18n._('Camera Capture')}
                                        <SvgIcon
                                            type={['static']}
                                            name="DropdownOpen"
                                            size={20}
                                            // className="margin-top-4"
                                        />
                                    </div>
                                </SvgIcon>
                            </div>
                        </Dropdown>
                    );
                }
            }
        );
    }

    const setBackgroundModal = showCameraCapture && renderModal({
        renderBody() {
            return (
                <div>
                    {isOriginalSeries && (
                        <LaserSetBackground
                            hideModal={() => {
                                setShowCameraCapture(false);
                            }}
                        />
                    )}
                    {!isOriginalSeries && (
                        <LaserCameraAidBackground
                            hideModal={() => {
                                setShowCameraCapture(false);
                            }}
                        />
                    )}
                </div>
            );
        },
        actions: [],
        onClose: () => { setShowCameraCapture(false); }
    });

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
