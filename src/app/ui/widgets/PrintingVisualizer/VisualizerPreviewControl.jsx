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
        // preview options
        showWallInner: false,
        showWallOuter: false,
        showSkin: false,
        showSkirt: false,
        showSupport: false,
        showFill: false,
        showTravel: false,
        showUnknown: false
    });
    const gcodeLine = useSelector(state => state?.printing?.gcodeLine, shallowEqual);
    const displayedType = useSelector(state => state?.printing?.displayedType, shallowEqual);
    const gcodeTypeInitialVisibility = useSelector(state => state?.printing?.gcodeTypeInitialVisibility, shallowEqual);
    const dispatch = useDispatch();
    const { showToggleBtn, renderToggleBtn } = useShowToggleBtn();


    function togglePreviewOptionFactory(option, type) {
        return (event) => {
            setAllShowTypes({ [option]: !allShowTypes[option] });
            dispatch(printingActions.setGcodeVisibilityByType(type, event.target.checked));
        };
    }


    useEffect(() => {
        setShowPreviewPanel(displayedType === 'gcode');
    }, [displayedType]);

    useEffect(() => {
        setAllShowTypes({
            showPreviewPanel: true,
            showWallInner: gcodeTypeInitialVisibility['WALL-INNER'],
            showWallOuter: gcodeTypeInitialVisibility['WALL-OUTER'],
            showSkin: gcodeTypeInitialVisibility.SKIN,
            showSkirt: gcodeTypeInitialVisibility.SKIRT,
            showSupport: gcodeTypeInitialVisibility.SUPPORT,
            showFill: gcodeTypeInitialVisibility.FILL,
            showTravel: gcodeTypeInitialVisibility.TRAVEL,
            showUnknown: gcodeTypeInitialVisibility.UNKNOWN
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
                                    {i18n._('key_ui/widgets/PrintingVisualizer/VisualizerPreviewControl_Line Type')}
                                </div>
                                <div className="padding-vertical-16 padding-horizontal-16">
                                    <div className="sm-flex justify-space-between height-24 margin-bottom-8">
                                        <div>
                                            <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#00ff00' }} />
                                            <span className="v-align-m margin-left-8">
                                                {i18n._('key_ui/widgets/PrintingVisualizer/VisualizerPreviewControl_Inner Wall')}
                                            </span>
                                        </div>
                                        <Checkbox
                                            checked={allShowTypes.showWallInner}
                                            onChange={togglePreviewOptionFactory('showWallInner', 'WALL-INNER')}
                                        />
                                    </div>
                                    <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                                        <div>
                                            <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#ff2121' }} />
                                            <span className="v-align-m margin-left-8">
                                                {i18n._('key_ui/widgets/PrintingVisualizer/VisualizerPreviewControl_Outer Wall')}
                                            </span>
                                        </div>
                                        <Checkbox
                                            checked={allShowTypes.showWallOuter}
                                            onChange={togglePreviewOptionFactory('showWallOuter', 'WALL-OUTER')}
                                        />
                                    </div>
                                    <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                                        <div>
                                            <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#ffff00' }} />
                                            <span className="v-align-m margin-left-8">
                                                {i18n._('key_ui/widgets/PrintingVisualizer/VisualizerPreviewControl_Skin')}
                                            </span>
                                        </div>
                                        <Checkbox
                                            checked={allShowTypes.showSkin}
                                            onChange={togglePreviewOptionFactory('showSkin', 'SKIN')}
                                        />
                                    </div>
                                    <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                                        <div>
                                            <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#4b0082' }} />
                                            <span className="v-align-m margin-left-8">
                                                {i18n._('key_ui/widgets/PrintingVisualizer/VisualizerPreviewControl_Helper')}
                                            </span>
                                        </div>
                                        <Checkbox
                                            checked={allShowTypes.showSupport}
                                            onChange={togglePreviewOptionFactory('showSupport', 'SUPPORT')}
                                        />
                                    </div>
                                    <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                                        <div>
                                            <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#8d4bbb' }} />
                                            <span className="v-align-m margin-left-8">
                                                {i18n._('key_ui/widgets/PrintingVisualizer/VisualizerPreviewControl_Fill')}
                                            </span>
                                        </div>
                                        <Checkbox
                                            checked={allShowTypes.showFill}
                                            onChange={togglePreviewOptionFactory('showFill', 'FILL')}
                                        />
                                    </div>
                                    <div className="sm-flex justify-space-between height-24 margin-vertical-8">
                                        <div>
                                            <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#44cef6' }} />
                                            <span className="v-align-m margin-left-8">
                                                {i18n._('key_ui/widgets/PrintingVisualizer/VisualizerPreviewControl_Travel')}
                                            </span>
                                        </div>
                                        <Checkbox
                                            checked={allShowTypes.showTravel}
                                            onChange={togglePreviewOptionFactory('showTravel', 'TRAVEL')}
                                        />
                                    </div>
                                    <div className="sm-flex justify-space-between height-24 margin-top-8">
                                        <div>
                                            <span className="display-inline width-16 height-16 v-align-m border-radius-4" style={{ backgroundColor: '#4b0082' }} />
                                            <span className="v-align-m margin-left-8">
                                                {i18n._('key_ui/widgets/PrintingVisualizer/VisualizerPreviewControl_Unknown')}
                                            </span>
                                        </div>
                                        <Checkbox
                                            checked={allShowTypes.showUnknown}
                                            onChange={togglePreviewOptionFactory('showUnknown', 'UNKNOWN')}
                                        />
                                    </div>
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
