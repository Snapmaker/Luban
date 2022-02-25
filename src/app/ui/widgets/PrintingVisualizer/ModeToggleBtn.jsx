import React, { useState } from 'react';
import classNames from 'classnames';
import { useSelector, useDispatch } from 'react-redux';
import Anchor from '../../components/Anchor';
import styles from './styles.styl';
import { actions as printingActions } from '../../../flux/printing';
import { GCODEPREVIEWMODES } from '../../../constants';

function ModeToggleBtn() {
    const dispatch = useDispatch();
    const gcodePreviewMode = useSelector(state => state?.printing?.gcodePreviewMode);

    const [showModesList, setShowModesList] = useState(true);
    const onToggleBtn = () => {
        setShowModesList(!showModesList);
    };

    const onToggleMode = (val) => {
        dispatch(printingActions.updateGcodePreviewMode(val));
    };

    return (
        <>
            <Anchor
                className={classNames(
                    'fa',
                    gcodePreviewMode,
                    styles['toggle-btn']
                )}
                onClick={onToggleBtn}
            >{
                    gcodePreviewMode
                }
            </Anchor>
            {
                showModesList && (
                    <div>
                        {
                            GCODEPREVIEWMODES.map((item) => {
                                return (
                                    <Anchor
                                        className={classNames(
                                            'fa',
                                            'fa-chevron-down'
                                        )}
                                        onClick={() => onToggleMode(item)}
                                    >{item}
                                    </Anchor>
                                );
                            })
                        }
                    </div>
                )
            }
        </>
    );
}

export default ModeToggleBtn;
