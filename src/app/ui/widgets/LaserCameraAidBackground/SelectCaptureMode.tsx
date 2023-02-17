import React from 'react';
import classNames from 'classnames';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';
import i18n from '../../../lib/i18n';

import conventionalModeIcon from './images/mode_conventional.svg';
import thicknessCompensationModeIcon from './images/mode_thickness_compensation.svg';

type TProps = {
    // series: string;
    onSelectMode: (mode: string) => void;
}

export const MODE_CONVENTIONAL = 'mode_conventional';
export const MODE_THICKNESS_COMPENSATION = 'mode_thickness_compensation';

const SelectCaptureMode: React.FC<TProps> = (props: TProps) => {
    return (
        <div className={classNames(styles['laser-select-capture-mode'])}>
            <Anchor
                className={classNames(styles.item)}
                onClick={() => {
                    props.onSelectMode(MODE_CONVENTIONAL);
                }}
            >
                <div className={classNames(styles.left)}>
                    <img src={conventionalModeIcon} alt="" />
                </div>
                <div className={classNames(styles.right)}>
                    <p className="font-weight-bold font-size-middle">{i18n._('key-Laser/CameraCapture-conventional mode')}</p>
                    <p>{i18n._('key-Laser/CameraCapture-conventional mode describe')}</p>
                </div>

            </Anchor>
            <Anchor
                className={classNames(styles.item)}
                onClick={() => {
                    props.onSelectMode(MODE_THICKNESS_COMPENSATION);
                }}
            >
                <div className={classNames(styles.left)}>
                    <img src={thicknessCompensationModeIcon} alt="" />
                </div>
                <div className={classNames(styles.right)}>
                    <p className="font-weight-bold font-size-middle">{i18n._('key-Laser/CameraCapture-thickness compensation mode')} (Beta)</p>
                    <p>{i18n._('key-Laser/CameraCapture-thickness compensation mode describe')}
                        <br />
                        {i18n._('key-Laser/CameraCapture-thickness compensation mode describe2')}
                    </p>
                </div>

            </Anchor>
        </div>
    );
};

export default SelectCaptureMode;
