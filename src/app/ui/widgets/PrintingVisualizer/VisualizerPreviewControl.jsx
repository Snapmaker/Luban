import React, { useState, useEffect } from 'react';
// import PropTypes from 'prop-types';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import classNames from 'classnames';
import { find } from 'lodash';
import Slider from '../../components/Slider';
import PreviewType from '../../components/PreviewType';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';
import { actions as printingActions } from '../../../flux/printing';
import i18n from '../../../lib/i18n';
import useSetState from '../../../lib/hooks/set-state';
import Select from '../../components/Select';
import { DUAL_EXTRUDER_TOOLHEAD_FOR_SM2, LEFT_EXTRUDER, RIGHT_EXTRUDER } from '../../../constants';
import { machineStore } from '../../../store/local-storage';

// TODO
const lineTypeObjects0 = [
    {
        fatherContent: i18n._('key-Printing/Preview-Inner Wall'),
        fatherColor: '#00ff00',
        showType: 'showWallInner',
        showTypeName: 'WALL-INNER'
    },
    {
        fatherContent: i18n._('key-Printing/Preview-Outer Wall'),
        fatherColor: '#ff2121',
        showType: 'showWallOuter',
        showTypeName: 'WALL-OUTER'
    },
    {
        fatherContent: i18n._('key-Printing/Preview-Skin'),
        fatherColor: '#ffff00',
        showType: 'showSkin',
        showTypeName: 'SKIN'
    },
    {
        fatherContent: i18n._('key-Printing/Preview-Helper'),
        fatherColor: '#4b0082',
        showType: 'showSupport',
        showTypeName: 'SUPPORT'
    },
    {
        fatherContent: i18n._('key-Printing/Preview-Fill'),
        fatherColor: '#8d4bbb',
        showType: 'showFill',
        showTypeName: 'FILL'
    },
    {
        fatherContent: i18n._('key-Printing/Preview-Travel'),
        fatherColor: '#44cef6',
        showType: 'showTravel',
        showTypeName: 'TRAVEL'
    },
    {
        fatherContent: i18n._('key-Printing/Preview-Unknown'),
        fatherColor: '#4b0082',
        showType: 'showUnknown',
        showTypeName: 'UNKNOWN'
    },
];

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
    // TODO, change init
    const gcodeTypeInitialVisibility = useSelector(state => state?.printing?.gcodeTypeInitialVisibility, shallowEqual);
    const renderLineType = useSelector(state => state?.printing?.renderLineType, shallowEqual);

    const materialDefinitions = useSelector(state => state?.printing?.materialDefinitions, shallowEqual);
    const defaultMaterialId = useSelector(state => state?.printing?.defaultMaterialId, shallowEqual);
    const defaultMaterialIdRight = useSelector(state => state?.printing?.defaultMaterialIdRight, shallowEqual);
    const leftExtrualMaterial = find(materialDefinitions, { definitionId: defaultMaterialId });
    const rightExtrualMaterial = find(materialDefinitions, { definitionId: defaultMaterialIdRight });
    const colorL = leftExtrualMaterial?.settings?.color?.default_value;
    const colorR = rightExtrualMaterial?.settings?.color?.default_value;

    const dispatch = useDispatch();
    const { showToggleBtn, renderToggleBtn } = useShowToggleBtn();

    function togglePreviewOptionFactoryByTypeAndDirection(option, type, direction) {
        return (event) => {
            allShowTypes[direction][option] = event.target.checked;
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
    }, [gcodeLine, gcodeTypeInitialVisibility]);

    if (!gcodeLine) {
        return null;
    }

    // TODO

    const lineTypeObjects1 = [
        {
            fatherContent: i18n._('key-Printing/Preview-Tool0'),
            fatherColor: colorL,
            childrenObjects: [
                {
                    value: allShowTypes[LEFT_EXTRUDER].showWallInner,
                    content: i18n._('key-Printing/Preview-Inner Wall'),
                    onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('showWallInner', 'WALL-INNER', LEFT_EXTRUDER)
                },
                {
                    value: allShowTypes[LEFT_EXTRUDER].showWallOuter,
                    content: i18n._('key-Printing/Preview-Outer Wall'),
                    onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('showWallOuter', 'WALL-OUTER', LEFT_EXTRUDER)
                },
                {
                    value: allShowTypes[LEFT_EXTRUDER].showSkin,
                    content: i18n._('key-Printing/Preview-Skin'),
                    onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('showSkin', 'SKIN', LEFT_EXTRUDER)
                },
                {
                    value: allShowTypes[LEFT_EXTRUDER].showSupport,
                    content: i18n._('key-Printing/Preview-Helper'),
                    onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('showSupport', 'SUPPORT', LEFT_EXTRUDER)
                },
                {
                    value: allShowTypes[LEFT_EXTRUDER].showFill,
                    content: i18n._('key-Printing/Preview-Fill'),
                    onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('showFill', 'FILL', LEFT_EXTRUDER)
                },
                {
                    value: allShowTypes[LEFT_EXTRUDER].showTravel,
                    content: i18n._('key-Printing/Preview-Travel'),
                    onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('showTravel', 'TRAVEL', LEFT_EXTRUDER)
                },
                {
                    value: allShowTypes[LEFT_EXTRUDER].showUnknown,
                    content: i18n._('key-Printing/Preview-Unknown'),
                    onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('showUnknown', 'UNKNOWN', LEFT_EXTRUDER)
                }
            ]
        },
        {
            fatherContent: i18n._('key-Printing/Preview-Tool1'),
            fatherColor: colorR,
            childrenObjects: [
                {
                    value: allShowTypes[RIGHT_EXTRUDER].showWallInner,
                    content: i18n._('key-Printing/Preview-Inner Wall'),
                    onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('showWallInner', 'WALL-INNER', RIGHT_EXTRUDER)
                },
                {
                    value: allShowTypes[RIGHT_EXTRUDER].showWallOuter,
                    content: i18n._('key-Printing/Preview-Outer Wall'),
                    onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('showWallOuter', 'WALL-OUTER', RIGHT_EXTRUDER)
                },
                {
                    value: allShowTypes[RIGHT_EXTRUDER].showSkin,
                    content: i18n._('key-Printing/Preview-Skin'),
                    onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('showSkin', 'SKIN', RIGHT_EXTRUDER)
                },
                {
                    value: allShowTypes[RIGHT_EXTRUDER].showSupport,
                    content: i18n._('key-Printing/Preview-Helper'),
                    onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('showSupport', 'SUPPORT', RIGHT_EXTRUDER)
                },
                {
                    value: allShowTypes[RIGHT_EXTRUDER].showFill,
                    content: i18n._('key-Printing/Preview-Fill'),
                    onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('showFill', 'FILL', RIGHT_EXTRUDER)
                },
                {
                    value: allShowTypes[RIGHT_EXTRUDER].showTravel,
                    content: i18n._('key-Printing/Preview-Travel'),
                    onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('showTravel', 'TRAVEL', RIGHT_EXTRUDER)
                },
                {
                    value: allShowTypes[RIGHT_EXTRUDER].showUnknown,
                    content: i18n._('key-Printing/Preview-Unknown'),
                    onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('showUnknown', 'UNKNOWN', RIGHT_EXTRUDER)
                }
            ]
        }
    ];
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
                                    {!renderLineType && (lineTypeObjects0.map((obj) => {
                                        const { fatherContent, fatherColor, showType, showTypeName } = obj;
                                        return (
                                            <PreviewType
                                                fatherContent={fatherContent}
                                                fatherColor={fatherColor}
                                                isDropdown={isDualExtruder}
                                                childrenObjects={
                                                    isDualExtruder ? [
                                                        {
                                                            value: allShowTypes[LEFT_EXTRUDER][showType],
                                                            content: i18n._('key-Printing/Preview-Tool0'),
                                                            onChangeValue: togglePreviewOptionFactoryByTypeAndDirection(showType, showTypeName, LEFT_EXTRUDER)
                                                        },
                                                        {
                                                            value: allShowTypes[RIGHT_EXTRUDER][showType],
                                                            content: i18n._('key-Printing/Preview-Tool1'),
                                                            onChangeValue: togglePreviewOptionFactoryByTypeAndDirection(showType, showTypeName, RIGHT_EXTRUDER)
                                                        }
                                                    ] : [
                                                        {
                                                            value: allShowTypes[LEFT_EXTRUDER][showType],
                                                            content: i18n._('key-Printing/Preview-Tool0'),
                                                            onChangeValue: togglePreviewOptionFactoryByTypeAndDirection(showType, showTypeName, LEFT_EXTRUDER)
                                                        }
                                                    ]
                                                }
                                            />
                                        );
                                    }))}
                                    {renderLineType && (lineTypeObjects1.map((obj) => {
                                        const { fatherContent, fatherColor, childrenObjects } = obj;
                                        return (
                                            <PreviewType
                                                fatherContent={fatherContent}
                                                fatherColor={fatherColor}
                                                isDropdown
                                                childrenObjects={childrenObjects}
                                            />
                                        );
                                    }))}
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
