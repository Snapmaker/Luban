import React, { useCallback, useEffect, useMemo, useState } from 'react';
// import PropTypes from 'prop-types';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';
import { find } from 'lodash';
import isElectron from 'is-electron';

import Slider from '../../components/Slider';
import PreviewType from '../../components/PreviewType';
import Anchor from '../../components/Anchor';
import { isDualExtruder } from '../../../constants/machines';
import { actions as printingActions } from '../../../flux/printing';
import i18n from '../../../lib/i18n';
import useSetState from '../../../lib/hooks/set-state';
import Select from '../../components/Select';
import { GCODEPREVIEWMODES, GCODEPREVIEWMODES_ICONS, LEFT_EXTRUDER, RIGHT_EXTRUDER } from '../../../constants';
import { machineStore } from '../../../store/local-storage';
import SvgIcon from '../../components/SvgIcon';
import Checkbox from '../../components/Checkbox';

import styles from './styles.styl';

// TODO
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
    const layerCount = useSelector(state => state?.printing?.layerCount - 1, shallowEqual);
    // const gcodePreviewMode = useSelector(state => state?.printing?.gcodePreviewMode, shallowEqual);
    const layerRangeDisplayed = useSelector(state => state?.printing?.layerRangeDisplayed, shallowEqual);
    const dispatch = useDispatch();
    // keep the slider highlight min-height 30px
    const temp = Math.round(30 / 288 * layerCount);

    const [value, setValue] = useState([]);
    useEffect(() => {
        setValue([
            layerRangeDisplayed[0],
            layerRangeDisplayed[1] + temp
        ]);
    }, [layerRangeDisplayed]);


    const onChangeShowLayer = (v) => {
        dispatch(printingActions.showGcodeLayers([
            v[0],
            v[1] - temp
        ]));
    };
    return (
        <div className={styles['layer-wrapper']}>
            <span className={styles['layer-label']}>{Math.round(layerRangeDisplayed[1], 10)}</span>
            <div
                style={{
                    position: 'relative',
                    marginLeft: '2px'
                }}
            >
                <Slider
                    tooltipVisible={false}
                    className={styles['vertical-slider']}
                    vertical
                    min={0}
                    max={layerCount + temp}
                    step={1}
                    range={{ draggableTrack: true }}
                    value={value}
                    onChange={(v) => {
                        onChangeShowLayer(v);
                    }}
                />
            </div>
            <span className={styles['layer-label']}>{Math.round(layerRangeDisplayed[0], 10)}</span>

        </div>
    );
}


function VisualizerPreviewControl() {
    const gcodeLine = useSelector(state => state?.printing?.gcodeLine, shallowEqual);
    const displayedType = useSelector(state => state?.printing?.displayedType, shallowEqual);
    // TODO, change init
    const gcodeTypeInitialVisibility = useSelector(state => state?.printing?.gcodeTypeInitialVisibility, shallowEqual);
    const renderLineType = useSelector(state => state?.printing?.renderLineType, shallowEqual);
    const gcodePreviewMode = useSelector(state => state?.printing?.gcodePreviewMode);
    const gcodePreviewModeToogleVisible = useSelector(state => state?.printing?.gcodePreviewModeToogleVisible);

    const isDual = isDualExtruder(machineStore.get('machine.toolHead.printingToolhead'));

    const materialDefinitions = useSelector(state => state?.printing?.materialDefinitions, shallowEqual);
    const defaultMaterialId = useSelector(state => state?.printing?.defaultMaterialId, shallowEqual);
    const defaultMaterialIdRight = useSelector(state => state?.printing?.defaultMaterialIdRight, shallowEqual);

    const leftExtrualMaterial = find(materialDefinitions, { definitionId: defaultMaterialId });
    const rightExtrualMaterial = find(materialDefinitions, { definitionId: defaultMaterialIdRight });
    const colorL = leftExtrualMaterial?.settings?.color?.default_value;
    const colorR = rightExtrualMaterial?.settings?.color?.default_value;


    const [showPreviewPanel, setShowPreviewPanel] = useState(true);
    const [allShowTypes, setAllShowTypes] = useSetState({});
    const [showOriginalModel, setShowOriginalModel] = useState(true);

    const dispatch = useDispatch();
    const { showToggleBtn, renderToggleBtn } = useShowToggleBtn();

    const togglePreviewOptionFactoryByTypeAndDirection = useCallback((showType, direction) => {
        return (event) => {
            allShowTypes[direction][showType] = event.target.checked;
            setAllShowTypes(allShowTypes);
            dispatch(printingActions.setGcodeVisibilityByTypeAndDirection(showType, direction, event.target.checked));
        };
    }, [dispatch, allShowTypes, setAllShowTypes]);

    function toggleShowOriginalModel(event) {
        const show = event.target.checked;
        // dispatch(printingActions.setShowOriginalModel(show));
        setShowOriginalModel(show);
    }

    function toggleRenderLineType(option) {
        dispatch(printingActions.updateState({
            renderLineType: option.value
        }));
        dispatch(printingActions.setGcodeColorByRenderLineType());
    }

    useEffect(() => {
        setShowPreviewPanel(displayedType === 'gcode');
        if (displayedType !== 'gcode') {
            dispatch(printingActions.updateState({
                gcodePreviewModeToogleVisible: 0
            }));
        }
        if (displayedType === 'gcode') {
            dispatch(printingActions.setShowOriginalModel(showOriginalModel));
        }
    }, [displayedType]);

    useEffect(() => {
        dispatch(printingActions.setShowOriginalModel(showOriginalModel));
    }, [showOriginalModel]);

    useEffect(() => {
        setAllShowTypes(gcodeTypeInitialVisibility);
    }, [setAllShowTypes, gcodeTypeInitialVisibility]);


    // TODO
    const lineTypeStructureObjects = [
        {
            fatherContent: i18n._('key-Printing/Preview-Inner Wall'),
            fatherColor: '#00ff00',
            showType: 'WALL-INNER'
        },
        {
            fatherContent: i18n._('key-Printing/Preview-Outer Wall'),
            fatherColor: '#ff2121',
            showType: 'WALL-OUTER'
        },
        {
            fatherContent: i18n._('key-Printing/Preview-Skin'),
            fatherColor: '#ffff00',
            showType: 'SKIN'
        },
        {
            fatherContent: i18n._('key-Printing/Preview-Helper'),
            fatherColor: '#4b0082',
            showType: 'SUPPORT'
        },
        {
            fatherContent: i18n._('key-Printing/Preview-Fill'),
            fatherColor: '#8d4bbb',
            showType: 'FILL'
        },
        {
            fatherContent: i18n._('key-Printing/Preview-Travel'),
            fatherColor: '#44cef6',
            showType: 'TRAVEL'
        },
        {
            fatherContent: i18n._('key-Printing/Preview-Unknown'),
            fatherColor: '#4b0082',
            showType: 'UNKNOWN'
        },
    ];

    const lineTypeExtruderObjects = useMemo(() => {
        if (!allShowTypes[LEFT_EXTRUDER] || !allShowTypes[RIGHT_EXTRUDER]) {
            return [];
        }

        return [
            {
                fatherContent: i18n._('key-Printing/Preview-Tool0'),
                fatherColor: colorL,
                childrenObjects: [
                    {
                        value: allShowTypes[LEFT_EXTRUDER]['WALL-INNER'],
                        content: i18n._('key-Printing/Preview-Inner Wall'),
                        onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('WALL-INNER', LEFT_EXTRUDER)
                    },
                    {
                        value: allShowTypes[LEFT_EXTRUDER]['WALL-OUTER'],
                        content: i18n._('key-Printing/Preview-Outer Wall'),
                        onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('WALL-OUTER', LEFT_EXTRUDER)
                    },
                    {
                        value: allShowTypes[LEFT_EXTRUDER].SKIN,
                        content: i18n._('key-Printing/Preview-Skin'),
                        onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('SKIN', LEFT_EXTRUDER)
                    },
                    {
                        value: allShowTypes[LEFT_EXTRUDER].SUPPORT,
                        content: i18n._('key-Printing/Preview-Helper'),
                        onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('SUPPORT', LEFT_EXTRUDER)
                    },
                    {
                        value: allShowTypes[LEFT_EXTRUDER].FILL,
                        content: i18n._('key-Printing/Preview-Fill'),
                        onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('FILL', LEFT_EXTRUDER)
                    },
                    {
                        value: allShowTypes[LEFT_EXTRUDER].TRAVEL,
                        content: i18n._('key-Printing/Preview-Travel'),
                        onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('TRAVEL', LEFT_EXTRUDER)
                    },
                    {
                        value: allShowTypes[LEFT_EXTRUDER].UNKNOWN,
                        content: i18n._('key-Printing/Preview-Unknown'),
                        onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('UNKNOWN', LEFT_EXTRUDER)
                    }
                ]
            },
            {
                fatherContent: i18n._('key-Printing/Preview-Tool1'),
                fatherColor: colorR,
                childrenObjects: [
                    {
                        value: allShowTypes[RIGHT_EXTRUDER]['WALL-INNER'],
                        content: i18n._('key-Printing/Preview-Inner Wall'),
                        onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('WALL-INNER', RIGHT_EXTRUDER)
                    },
                    {
                        value: allShowTypes[RIGHT_EXTRUDER]['WALL-OUTER'],
                        content: i18n._('key-Printing/Preview-Outer Wall'),
                        onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('WALL-OUTER', RIGHT_EXTRUDER)
                    },
                    {
                        value: allShowTypes[RIGHT_EXTRUDER].SKIN,
                        content: i18n._('key-Printing/Preview-Skin'),
                        onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('SKIN', RIGHT_EXTRUDER)
                    },
                    {
                        value: allShowTypes[RIGHT_EXTRUDER].SUPPORT,
                        content: i18n._('key-Printing/Preview-Helper'),
                        onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('SUPPORT', RIGHT_EXTRUDER)
                    },
                    {
                        value: allShowTypes[RIGHT_EXTRUDER].FILL,
                        content: i18n._('key-Printing/Preview-Fill'),
                        onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('FILL', RIGHT_EXTRUDER)
                    },
                    {
                        value: allShowTypes[RIGHT_EXTRUDER].TRAVEL,
                        content: i18n._('key-Printing/Preview-Travel'),
                        onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('TRAVEL', RIGHT_EXTRUDER)
                    },
                    {
                        value: allShowTypes[RIGHT_EXTRUDER].UNKNOWN,
                        content: i18n._('key-Printing/Preview-Unknown'),
                        onChangeValue: togglePreviewOptionFactoryByTypeAndDirection('UNKNOWN', RIGHT_EXTRUDER)
                    }
                ]
            }
        ];
    }, [allShowTypes, colorL, colorR, togglePreviewOptionFactoryByTypeAndDirection]);

    if (!gcodeLine || !allShowTypes[LEFT_EXTRUDER]) {
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
                                    'position-absolute',
                                    'width-200',
                                    'border-default-grey-1',
                                    'border-radius-8',
                                    'background-color-white',
                                )}
                            >
                                <div className="border-bottom-normal padding-horizontal-16 height-40 heading-3">
                                    {i18n._('key-Printing/Preview-Line Type')}
                                </div>
                                <div className="padding-vertical-12 padding-left-16">
                                    {isDual && (
                                        <div className="sm-flex justify-space-between height-24 margin-bottom-10">
                                            <div>
                                                <span className="v-align-m">
                                                    {i18n._('key-Printing/Preview-Color Scheme')}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    {isDual && (
                                        <div className="sm-flex justify-space-between margin-top-10">
                                            <Select
                                                size="large"
                                                value={renderLineType}
                                                onChange={toggleRenderLineType}
                                                options={[
                                                    {
                                                        value: true,
                                                        label: i18n._('key-Printing/Preview_Options-Extruder')
                                                    },
                                                    {
                                                        value: false,
                                                        label: i18n._('key-Printing/Preview_Options-Line Type')
                                                    }
                                                ]}
                                            />
                                        </div>
                                    )}
                                    <div
                                        style={{
                                            overflow: 'auto',
                                            maxHeight: '440px'
                                        }}
                                    >
                                        {!renderLineType && (lineTypeStructureObjects.map((obj) => {
                                            const { fatherContent, fatherColor, showType } = obj;
                                            return (
                                                <PreviewType
                                                    fatherContent={fatherContent}
                                                    key={fatherContent}
                                                    fatherColor={fatherColor}
                                                    isDropdown={isDual}
                                                    childrenObjects={
                                                        isDual ? [
                                                            {
                                                                value: allShowTypes[LEFT_EXTRUDER][showType],
                                                                content: i18n._('key-Printing/Preview-Tool0'),
                                                                onChangeValue: togglePreviewOptionFactoryByTypeAndDirection(showType, LEFT_EXTRUDER)
                                                            },
                                                            {
                                                                value: allShowTypes[RIGHT_EXTRUDER][showType],
                                                                content: i18n._('key-Printing/Preview-Tool1'),
                                                                onChangeValue: togglePreviewOptionFactoryByTypeAndDirection(showType, RIGHT_EXTRUDER)
                                                            }
                                                        ] : [
                                                            {
                                                                value: allShowTypes[LEFT_EXTRUDER][showType],
                                                                content: i18n._('key-Printing/Preview-Tool0'),
                                                                onChangeValue: togglePreviewOptionFactoryByTypeAndDirection(showType, LEFT_EXTRUDER)
                                                            }
                                                        ]
                                                    }
                                                />
                                            );
                                        }))}
                                        {renderLineType && (lineTypeExtruderObjects.map((obj) => {
                                            const { fatherContent, fatherColor, childrenObjects } = obj;
                                            return (
                                                <PreviewType
                                                    key={fatherContent}
                                                    fatherContent={fatherContent}
                                                    fatherColor={fatherColor}
                                                    isDropdown
                                                    childrenObjects={childrenObjects}
                                                />
                                            );
                                        }))}

                                        <div className="border-top-normal padding-right-16 margin-right-16" />
                                        <div className="sm-flex justify-space-between height-24 margin-top-8 padding-right-16">
                                            <div>
                                                <Checkbox
                                                    checked={showOriginalModel}
                                                    onChange={(event) => {
                                                        toggleShowOriginalModel(event);
                                                    }}
                                                />
                                                <span className="v-align-m margin-left-8">
                                                    {i18n._('key-Printing/Preview-Model View')}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#D5D6D9' }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div>
                            <SvgIcon
                                className={classNames(
                                    'fa',
                                    styles['toggle-btn']
                                )}
                                name={GCODEPREVIEWMODES_ICONS[GCODEPREVIEWMODES.findIndex(i => i === gcodePreviewMode)]}
                                size={24}
                                type={['static']}
                                onClick={(e) => {
                                    if (gcodePreviewModeToogleVisible) {
                                        dispatch(printingActions.updateState({
                                            gcodePreviewModeToogleVisible: 0
                                        }));
                                    } else {
                                        let modalHeight = e.pageY - 58 - 24;
                                        if (!isElectron()) {
                                            modalHeight -= 26;
                                        }
                                        dispatch(printingActions.updateState({
                                            gcodePreviewModeToogleVisible: modalHeight
                                        }));
                                    }
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </React.Fragment>
    );
}


export default VisualizerPreviewControl;
