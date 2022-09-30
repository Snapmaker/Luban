import React from 'react';
import classNames from 'classnames';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';
import i18n from '../../../lib/i18n';


type TProps = {
    // series: string;
    onSelectMode: (mode: string) => void;
}

export const MODE_CONVENTIONAL = 'mode_conventional';
export const MODE_THICKNESS_COMPENSATION = 'mode_thickness_compensation';

const SelectCaptureMode = (props: TProps) => {
    return (
        <div className={classNames(styles['laser-select-capture-mode'])}>
            <Anchor
                className={classNames(styles.item)}
                onClick={() => {
                    props.onSelectMode(MODE_CONVENTIONAL);
                }}
            >
                <div className={classNames(styles.left)}>
                    <img src={require('./images/mode_conventional.svg')} alt="" />
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
                    <img src={require('./images/mode_thickness_compensation.svg')} alt="" />
                </div>
                <div className={classNames(styles.right)}>
                    <p className="font-weight-bold font-size-middle">{i18n._('key-Laser/CameraCapture-thickness compensation mode')}</p>
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
