import React from 'react';
import PropTypes from 'prop-types';
import { useSelector, shallowEqual, useDispatch } from 'react-redux';
import classNames from 'classnames';
import i18n from '../../../lib/i18n';
/* eslint-disable-next-line import/no-cycle */
import { CancelButton } from '../../widgets/PrintingVisualizer/VisualizerLeftBar';
import { actions as printingActions } from '../../../flux/printing';
import { Button } from '../../components/Buttons';
import { HEAD_PRINTING } from '../../../constants';
import { logTransformOperation } from '../../../lib/gaEvent';
import styles from './styles.styl';

const MirrorOverlay = React.memo(({
    setTransformMode,
    updateBoundingBox
}) => {
    const transformation = useSelector(state => state?.printing?.modelGroup?.getSelectedModelTransformationForPrinting(), shallowEqual);
    const isSelectedModelAllVisible = useSelector(state => state?.printing?.modelGroup?.isSelectedModelAllVisible(), shallowEqual);

    const dispatch = useDispatch();
    const mirrorSelectedModel = (value) => {
        switch (value) {
            case 'X':
                dispatch(printingActions.updateSelectedModelTransformation({
                    scaleX: transformation.scaleX * -1
                }, false));
                break;
            case 'Y':
                dispatch(printingActions.updateSelectedModelTransformation({
                    scaleY: transformation.scaleY * -1
                }, false));
                break;
            case 'Z':
                dispatch(printingActions.updateSelectedModelTransformation({
                    scaleZ: transformation.scaleZ * -1
                }, false));
                break;
            case 'Reset':
                dispatch(printingActions.updateSelectedModelTransformation({
                    scaleX: Math.abs(transformation.scaleX),
                    scaleY: Math.abs(transformation.scaleY),
                    scaleZ: Math.abs(transformation.scaleZ)
                }, false));
                break;
            default:
                break;
        }
        logTransformOperation(HEAD_PRINTING, 'mirror', 'button');
        updateBoundingBox();
    };
    return (
        <div
            className="position-absolute width-280 margin-left-72 border-default-grey-1 border-radius-8 background-color-white"
            style={{
                marginTop: '216px'
            }}
        >
            <div
                className={classNames(
                    styles['overlay-title-font'],
                    'sm-flex justify-space-between',
                    'border-bottom-normal padding-horizontal-16 height-40',
                )}
            >
                {i18n._('key-Printing/LeftBar-Mirror')}
                <CancelButton
                    onClick={() => setTransformMode('')}
                />
            </div>
            <div className="padding-vertical-16 padding-horizontal-16">
                <div className="sm-flex">
                    <Button
                        className="margin-right-8"
                        type="primary"
                        priority="level-three"
                        width="100%"
                        disabled={!isSelectedModelAllVisible}
                        onClick={() => mirrorSelectedModel('X')}
                    >
                        <span className="color-red-1">{i18n._('key-Printing/LeftBar-X ')}</span>
                        <span>{i18n._('key-Printing/LeftBar-axis')}</span>
                    </Button>
                    <Button
                        className="margin-horizontal-8"
                        type="primary"
                        priority="level-three"
                        width="100%"
                        disabled={!isSelectedModelAllVisible}
                        onClick={() => mirrorSelectedModel('Y')}
                    >
                        <span className="color-green-1">{i18n._('key-Printing/LeftBar-Y ')}</span>
                        <span>{i18n._('key-Printing/LeftBar-axis')}</span>
                    </Button>
                    <Button
                        className="margin-left-8"
                        type="primary"
                        priority="level-three"
                        width="100%"
                        disabled={!isSelectedModelAllVisible}
                        onClick={() => mirrorSelectedModel('Z')}
                    >
                        <span className="color-blue-2">{i18n._('key-Printing/LeftBar-Z ')}</span>
                        <span>{i18n._('key-Printing/LeftBar-axis')}</span>
                    </Button>
                </div>
            </div>
        </div>
    );
});

MirrorOverlay.propTypes = {
    setTransformMode: PropTypes.func.isRequired,
    updateBoundingBox: PropTypes.func.isRequired
};
export default MirrorOverlay;
