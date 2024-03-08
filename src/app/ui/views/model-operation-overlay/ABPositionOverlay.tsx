import classNames from 'classnames';
import React from 'react';
import { Alert, Button } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import styles from './styles.styl';
import i18n from '../../../lib/i18n';
import ConnectionControl from '../../widgets/ConnectionControl/index';
import { RootState } from '../../../flux/index.def';
import { actions as laserActions } from '../../../flux/laser/index';

interface ABPositionOverlayProps {
    onClose: () => void;
}

const ABPositionOverlay: React.FC<ABPositionOverlayProps> = (props) => {
    const { size } = useSelector((state: RootState) => state.machine);
    const { APosition, BPosition } = useSelector((state: RootState) => state.laser);
    const dispatch = useDispatch();

    // const isNUllPosition = position => {
    //     return typeof position.x === 'undefined'
    //     || typeof position.y === 'undefined'
    //     || typeof position.z === 'undefined'
    //     || typeof position.b === 'undefined';
    // };
    // const isSamePosition = (positionA, positionB) => {
    //     return positionA.x === positionB.x
    //     && positionA.y === positionB.y
    //     && positionA.z === positionB.z
    //     && positionA.b === positionB.b;
    // };
    const setSvgBackground = () => {
        // if (isNUllPosition(APosition) || isNUllPosition(BPosition)) {
        //     message.warn('A or B position is not setting.');
        //     return;
        // }
        // if (isSamePosition(APosition, BPosition)) {
        //     message.warn('The positions A and B are identical. Please select two different positions.');
        //     return;
        // }
        console.log(`width: ${size.x}, height: ${size.y}`);
        dispatch(laserActions.setBackgroundImage('', size.x, size.y, 0, 0, { APosition, BPosition }));
    };
    const settingDone = () => {
        props.onClose();
        setSvgBackground();
    };


    const widgetActions = {
        setTitle: function () { return null; }
    };

    return (
        <div className={classNames(
            styles['ab-position-overlay'],
            'width-360 position-absolute margin-left-72',
            'border-default-grey-1 border-radius-8 background-color-white',
        )}
        >
            <div className={classNames(styles['overlay-title-font'], 'border-bottom-normal padding-vertical-8 padding-horizontal-16')}>
                {i18n._('key-CncLaser/MainToolBar-A-B Position')}
            </div>
            <div className="justify-space-between padding-vertical-16 padding-horizontal-16">
                <Alert className="width-percent-100 border-radius-8" message="Use the control panel to position points A and B on the machine." type="info" showIcon />
                <div className="">
                    <ConnectionControl widgetId="control" widgetActions={widgetActions} isInWorkspace />
                </div>
            </div>
            <div className="background-grey-3 padding-vertical-8 sm-flex padding-horizontal-16 justify-space-between border-radius-bottom-8 sm-flex justify-flex-end">
                <Button
                    className={classNames(styles['ab-position-done-btn'])}
                    onClick={settingDone}
                    priority="level-two"
                    width="96px"
                    type="default"
                >
                    {i18n._('key-Modal/Common-Done')}
                </Button>
            </div>
        </div>
    );
};

export default ABPositionOverlay;
