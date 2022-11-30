import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { useSelector, useDispatch } from 'react-redux';
import { actions as printingActions } from '../../../flux/printing';
import { GCODEPREVIEWMODES, GCODEPREVIEWMODES_ICONS } from '../../../constants';
import SvgIcon from '../../components/SvgIcon';
import { Radio } from '../../components/Radio';
import i18n from '../../../lib/i18n';

function ModeToggleBtn() {
    const dispatch = useDispatch();
    const gcodePreviewMode = useSelector(state => state?.printing?.gcodePreviewMode);
    const gcodePreviewModeToogleVisible = useSelector(state => state?.printing?.gcodePreviewModeToogleVisible);

    const onToggleMode = (val) => {
        dispatch(printingActions.updateGcodePreviewMode(val));
    };

    const [modalStyle, setModalStyle] = useState({});
    useEffect(() => {
        const style = {
            position: 'absolute',
            zIndex: 600,
            right: '45px'
        };
        if (document.body.clientHeight - gcodePreviewModeToogleVisible - 138 <= 16) {
            style.bottom = '16px';
            style.top = 'auto';
        } else {
            style.top = `${gcodePreviewModeToogleVisible}px`;
            style.bottom = 'auto';
        }
        setModalStyle(style);
    }, [gcodePreviewModeToogleVisible]);

    if (gcodePreviewModeToogleVisible) {
        return (
            <div
                style={modalStyle}
                className={classNames(
                    'position-absolute',
                    'width-200',
                    'border-default-grey-1',
                    'border-radius-8',
                    'background-color-white',
                )}
            >

                <div>
                    <Radio.Group
                        style={{ width: '100%' }}
                        name="comic"
                        value={gcodePreviewMode}
                        onChange={(event) => {
                            const value = event.target.value;
                            onToggleMode(value);
                        }}
                    >

                        {
                            GCODEPREVIEWMODES.map((item, index) => {
                                return (
                                    <div
                                        key={item}
                                        style={{ margin: '16px', marginRight: '10px' }}
                                        className="sm-flex justify-space-between height-24"
                                    >
                                        <div className="font-roboto font-weight-normal font-size-middle">
                                            <SvgIcon
                                                name={GCODEPREVIEWMODES_ICONS[index]}
                                                size={24}
                                                type={['static']}
                                            />

                                            <span style={{ fontSize: '14px' }} className="v-align-m margin-left-8">
                                                {i18n._(`key-Progress/3DP-${item}`)}
                                            </span>
                                        </div>
                                        <div>
                                            <Radio value={item} />
                                        </div>
                                    </div>

                                );
                            })
                        }
                    </Radio.Group>
                </div>
            </div>
        );
    } else {
        return null;
    }
}

export default ModeToggleBtn;
