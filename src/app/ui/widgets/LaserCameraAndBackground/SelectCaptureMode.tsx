import React from 'react';
import classNames from 'classnames';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';

type TProps = {
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
                    <p className="font-weight-bold font-size-middle">常规模式</p>
                    <p>{'适用于较薄工件 < 10mm'}</p>
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
                    <p className="font-weight-bold font-size-middle">厚度补偿模式</p>
                    <p>{'适用于较厚工件 {范围区间}，应用在薄工件上也会有更精确的结果'}
                        <br />
                        依据材料厚度不同，由于透视畸变，可能会无法适应较大工件
                    </p>
                </div>

            </Anchor>
        </div>
    );
};

export default SelectCaptureMode;
