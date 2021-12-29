import React, { useState, useEffect } from 'react';
// import PropTypes from 'prop-types';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import classNames from 'classnames';
import Slider from '../../components/Slider';
import Checkbox from '../../components/Checkbox';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';
import { actions as printingActions } from '../../../flux/printing';
import i18n from '../../../lib/i18n';
import useSetState from '../../../lib/hooks/set-state';
import Select from '../../components/Select';
import { DUAL_EXTRUDER_TOOLHEAD_FOR_SM2, LEFT_EXTRUDER, RIGHT_EXTRUDER } from '../../../constants';
import { machineStore } from '../../../store/local-storage';

function useShowToggleBtn() {
    const [showToggleBtn, setShowToggleBtn] = useState(true);
    function onToggleToggleBtn() {
        setShowToggleBtn(!showToggleBtn);
    }
    return {
        renderToggleBtn: () => {
            return (
                <Anchor
                    className={classNames(
                        'fa',
                        showToggleBtn ? 'fa-chevron-right' : 'fa-chevron-left',
                        styles['toggle-btn']
                    )}
                    onClick={onToggleToggleBtn}
                />
            );
        },
        showToggleBtn
    };
}

function GcodeLayout() {
    const layerCount = useSelector(state => state?.printing?.layerCount, shallowEqual);
    const layerCountDisplayed = useSelector(state => state?.printing?.layerCountDisplayed, shallowEqual);
    const dispatch = useDispatch();

    function onChangeShowLayer(value) {
        dispatch(printingActions.showGcodeLayers(value));
    }
    return (
        <div className={styles['layer-wrapper']}>
            <span className={styles['layer-label']}>{layerCountDisplayed}</span>
            <div
                style={{
                    position: 'relative',
                    marginLeft: '2px'
                }}
            >
                <Slider
                    className={styles['vertical-slider']}
                    vertical
                    min={0}
                    max={layerCount - 1}
                    step={1}
                    value={layerCountDisplayed}
                    onChange={(value) => {
                        onChangeShowLayer(value);
                    }}
                />
            </div>
        </div>
    );
}

function VisualizerPreviewControl() {
    const [showPreviewPanel, setShowPreviewPanel] = useState(true);
    const [allShowTypes, setAllShowTypes] = useSetState({
        [LEFT_EXTRUDER]: {
            showWallInner: false,
            showWallOuter: false,
            showSkin: false,
            showSkirt: false,
            showSupport: false,
            showFill: false,
            showTravel: false,
            showUnknown: false,
        },
        [RIGHT_EXTRUDER]: {
            showWallInner: false,
            showWallOuter: false,
            showSkin: false,
            showSkirt: false,
            showSupport: false,
            showFill: false,
            showTravel: false,
            showUnknown: false,
        }
    });
    const isDualExtruder = (machineStore.get('machine.toolHead.printingToolhead') === DUAL_EXTRUDER_TOOLHEAD_FOR_SM2);
    const gcodeLine = useSelector(state => state?.printing?.gcodeLine, shallowEqual);
    const displayedType = useSelector(state => state?.printing?.displayedType, shallowEqual);
    const gcodeTypeInitialVisibility = useSelector(state => state?.printing?.gcodeTypeInitialVisibility, shallowEqual);
    const renderLineType = useSelector(state => state?.printing?.renderLineType, shallowEqual);
    const dispatch = useDispatch();
    const { showToggleBtn, renderToggleBtn } = useShowToggleBtn();

    function togglePreviewOptionFactoryByTypeAndDirection(option, type, direction) {
        return (event) => {
            allShowTypes[direction][option] = !allShowTypes[direction][option];
            setAllShowTypes(allShowTypes);
            dispatch(printingActions.setGcodeVisibilityByTypeAndDirection(type, direction, event.target.checked));
        };
    }

    function toggleRenderLineType(option) {
        dispatch(printingActions.updateState({
            renderLineType: option.value
        }));
        dispatch(printingActions.setGcodeColorByRenderLineType());
    }

    useEffect(() => {
        setShowPreviewPanel(displayedType === 'gcode');
    }, [displayedType]);

    useEffect(() => {
        setAllShowTypes({
            [LEFT_EXTRUDER]: {
                showPreviewPanel: true,
                showWallInner: gcodeTypeInitialVisibility['WALL-INNER'],
                showWallOuter: gcodeTypeInitialVisibility['WALL-OUTER'],
                showSkin: gcodeTypeInitialVisibility.SKIN,
                showSkirt: gcodeTypeInitialVisibility.SKIRT,
                showSupport: gcodeTypeInitialVisibility.SUPPORT,
                showFill: gcodeTypeInitialVisibility.FILL,
                showTravel: gcodeTypeInitialVisibility.TRAVEL,
                showUnknown: gcodeTypeInitialVisibility.UNKNOWN
            },
            [RIGHT_EXTRUDER]: {
                showPreviewPanel: true,
                showWallInner: gcodeTypeInitialVisibility['WALL-INNER'],
                showWallOuter: gcodeTypeInitialVisibility['WALL-OUTER'],
                showSkin: gcodeTypeInitialVisibility.SKIN,
                showSkirt: gcodeTypeInitialVisibility.SKIRT,
                showSupport: gcodeTypeInitialVisibility.SUPPORT,
                showFill: gcodeTypeInitialVisibility.FILL,
                showTravel: gcodeTypeInitialVisibility.TRAVEL,
                showUnknown: gcodeTypeInitialVisibility.UNKNOWN
            }
        });
    }, [gcodeTypeInitialVisibility, setAllShowTypes]);

    if (!gcodeLine) {
        return null;
    }
    return (
        <React.Fragment>
            <div>
                {showPreviewPanel && (
                    <div>
                        <GcodeLayout />
                        {renderToggleBtn()}
                        {showToggleBtn && (
                            <div
                                className={classNames(
                                    styles['preview-panel'],
                                    'position-ab',
                                    'width-200',
                                    'border-default-grey-1',
                                    'border-radius-8',
                                    'background-color-white',
                                )}
                            >
                                <div className="border-bottom-normal padding-vertical-10 padding-horizontal-16 height-40 heading-3">
                                    {i18n._('key-Printing/Preview-Line Type')}
                                </div>
                                <div className="padding-vertical-16 padding-horizontal-16">
                                    { isDualExtruder && (
                                        <div className="sm-flex justify-space-between height-24 margin-bottom-8">
                                            <div>
                                                <span className="v-align-m margin-left-8">
                                                    {i18n._('Color Method')}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    { isDualExtruder && (
                                        <div className="sm-flex justify-space-between margin-vertical-8">
                                            <Select
                                                className={classNames(
                                                    'margin-top-16'
                                                )}
                                                size="large"
                                                value={renderLineType}
                                                onChange={toggleRenderLineType}
                                                options={[
                                                    {
                                                        value: true,
                                                        label: '按喷嘴'
                                                    },
                                                    {
                                                        value: false,
                                                        label: '按结构'
                                                    }
                                                ]}
                                            />
                                        </div>
                                    )}
                                    {/*<div className="sm-flex justify-space-between height-24 margin-vertical-8">*/}
                                    {/*    <div>*/}
                                    {/*        <Checkbox*/}
                                    {/*            checked={allShowTypes.showTool0}*/}
                                    {/*            onChange={togglePreviewOptionFactory('showTool0', 'TOOL0')}*/}
                                    {/*        />*/}
                                    {/*        <span className="v-align-m margin-left-8">*/}
                                    {/*            {i18n._('key-Printing/Preview-Tool0')}*/}
                                    {/*        </span>*/}
                                    {/*    </div>*/}
                                    {/*    <div>*/}
                                    {/*        <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#4b0082' }} />*/}
                                    {/*    </div>*/}
                                    {/*</div>*/}
                                    {/*<div className="sm-flex justify-space-between height-24 margin-vertical-8">*/}
                                    {/*    <div>*/}
                                    {/*        <Checkbox*/}
                                    {/*            checked={allShowTypes.showTool1}*/}
                                    {/*            onChange={togglePreviewOptionFactory('showTool1', 'TOOL1')}*/}
                                    {/*        />*/}
                                    {/*        <span className="v-align-m margin-left-8">*/}
                                    {/*            {i18n._('key-Printing/Preview-Tool1')}*/}
                                    {/*        </span>*/}
                                    {/*    </div>*/}
                                    {/*    <div>*/}
                                    {/*        <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#4b0082' }} />*/}
                                    {/*    </div>*/}
                                    {/*</div>*/}
                                    <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                                        <div>
                                            <Checkbox
                                                checked={allShowTypes[LEFT_EXTRUDER].showWallInner}
                                                onChange={togglePreviewOptionFactoryByTypeAndDirection('showWallInner', 'WALL-INNER', LEFT_EXTRUDER)}
                                            />
                                            <span className="v-align-m margin-left-8">
                                                {i18n._('key-Printing/Preview-Inner Wall')}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#00ff00' }} />
                                        </div>
                                    </div>
                                    {isDualExtruder && (
                                        <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                                            <div>
                                                <Checkbox
                                                    checked={allShowTypes[RIGHT_EXTRUDER].showWallInner}
                                                    onChange={togglePreviewOptionFactoryByTypeAndDirection('showWallInner', 'WALL-INNER', RIGHT_EXTRUDER)}
                                                />
                                                <span className="v-align-m margin-left-8">
                                                    {i18n._('key-Printing/Preview-Inner Wall')}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#00ff00' }} />
                                            </div>
                                        </div>
                                    )}
                                    <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                                        <div>
                                            <Checkbox
                                                checked={allShowTypes[LEFT_EXTRUDER].showWallOuter}
                                                onChange={togglePreviewOptionFactoryByTypeAndDirection('showWallOuter', 'WALL-OUTER', LEFT_EXTRUDER)}
                                            />
                                            <span className="v-align-m margin-left-8">
                                                {i18n._('key-Printing/Preview-Outer Wall')}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#ff2121' }} />
                                        </div>
                                    </div>
                                    { isDualExtruder && (
                                        <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                                            <div>
                                                <Checkbox
                                                    checked={allShowTypes[RIGHT_EXTRUDER].showWallOuter}
                                                    onChange={togglePreviewOptionFactoryByTypeAndDirection('showWallOuter', 'WALL-OUTER', RIGHT_EXTRUDER)}
                                                />
                                                <span className="v-align-m margin-left-8">
                                                    {i18n._('key-Printing/Preview-Outer Wall')}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#ff2121' }} />
                                            </div>
                                        </div>
                                    )}
                                    <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                                        <div>
                                            <Checkbox
                                                checked={allShowTypes[LEFT_EXTRUDER].showSkin}
                                                onChange={togglePreviewOptionFactoryByTypeAndDirection('showSkin', 'SKIN', LEFT_EXTRUDER)}
                                            />
                                            <span className="v-align-m margin-left-8">
                                                {i18n._('key-Printing/Preview-Skin')}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#ffff00' }} />
                                        </div>
                                    </div>
                                    { isDualExtruder && (
                                        <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                                            <div>
                                                <Checkbox
                                                    checked={allShowTypes[RIGHT_EXTRUDER].showSkin}
                                                    onChange={togglePreviewOptionFactoryByTypeAndDirection('showSkin', 'SKIN', RIGHT_EXTRUDER)}
                                                />
                                                <span className="v-align-m margin-left-8">
                                                    {i18n._('key-Printing/Preview-Skin')}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#ffff00' }} />
                                            </div>
                                        </div>
                                    )}
                                    <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                                        <div>
                                            <Checkbox
                                                checked={allShowTypes[LEFT_EXTRUDER].showSupport}
                                                onChange={togglePreviewOptionFactoryByTypeAndDirection('showSupport', 'SUPPORT', LEFT_EXTRUDER)}
                                            />
                                            <span className="v-align-m margin-left-8">
                                                {i18n._('key-Printing/Preview-Helper')}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#4b0082' }} />
                                        </div>
                                    </div>
                                    { isDualExtruder && (
                                        <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                                            <div>
                                                <Checkbox
                                                    checked={allShowTypes[RIGHT_EXTRUDER].showSupport}
                                                    onChange={togglePreviewOptionFactoryByTypeAndDirection('showSupport', 'SUPPORT', RIGHT_EXTRUDER)}
                                                />
                                                <span className="v-align-m margin-left-8">
                                                    {i18n._('key-Printing/Preview-Helper')}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#4b0082' }} />
                                            </div>
                                        </div>
                                    )}
                                    <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                                        <div>
                                            <Checkbox
                                                checked={allShowTypes[LEFT_EXTRUDER].showFill}
                                                onChange={togglePreviewOptionFactoryByTypeAndDirection('showFill', 'FILL', LEFT_EXTRUDER)}
                                            />
                                            <span className="v-align-m margin-left-8">
                                                {i18n._('key-Printing/Preview-Fill')}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#8d4bbb' }} />
                                        </div>
                                    </div>
                                    { isDualExtruder && (
                                        <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                                            <div>
                                                <Checkbox
                                                    checked={allShowTypes[RIGHT_EXTRUDER].showFill}
                                                    onChange={togglePreviewOptionFactoryByTypeAndDirection('showFill', 'FILL', RIGHT_EXTRUDER)}
                                                />
                                                <span className="v-align-m margin-left-8">
                                                    {i18n._('key-Printing/Preview-Fill')}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#8d4bbb' }} />
                                            </div>
                                        </div>
                                    )}
                                    <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                                        <div>
                                            <Checkbox
                                                checked={allShowTypes[LEFT_EXTRUDER].showTravel}
                                                onChange={togglePreviewOptionFactoryByTypeAndDirection('showTravel', 'TRAVEL', LEFT_EXTRUDER)}
                                            />
                                            <span className="v-align-m margin-left-8">
                                                {i18n._('key-Printing/Preview-Travel')}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#44cef6' }} />
                                        </div>
                                    </div>
                                    { isDualExtruder && (
                                        <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                                            <div>
                                                <Checkbox
                                                    checked={allShowTypes[RIGHT_EXTRUDER].showTravel}
                                                    onChange={togglePreviewOptionFactoryByTypeAndDirection('showTravel', 'TRAVEL', RIGHT_EXTRUDER)}
                                                />
                                                <span className="v-align-m margin-left-8">
                                                    {i18n._('key-Printing/Preview-Travel')}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#44cef6' }} />
                                            </div>
                                        </div>
                                    )}
                                    <div className="sm-flex justify-space-between height-24 margin-top-8">
                                        <div>
                                            <Checkbox
                                                checked={allShowTypes[LEFT_EXTRUDER].showUnknown}
                                                onChange={togglePreviewOptionFactoryByTypeAndDirection('showUnknown', 'UNKNOWN', LEFT_EXTRUDER)}
                                            />
                                            <span className="v-align-m margin-left-8">
                                                {i18n._('key-Printing/Preview-Unknown')}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#4b0082' }} />
                                        </div>
                                    </div>
                                    { isDualExtruder && (
                                        <div className="sm-flex justify-space-between height-24 margin-top-8">
                                            <div>
                                                <Checkbox
                                                    checked={allShowTypes[RIGHT_EXTRUDER].showUnknown}
                                                    onChange={togglePreviewOptionFactoryByTypeAndDirection('showUnknown', 'UNKNOWN', RIGHT_EXTRUDER)}
                                                />
                                                <span className="v-align-m margin-left-8">
                                                    {i18n._('key-Printing/Preview-Unknown')}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#4b0082' }} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </React.Fragment>
    );
}


export default VisualizerPreviewControl;
