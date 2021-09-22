import React from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';

import i18n from '../../../../lib/i18n';
import { actions as editorActions } from '../../../../flux/editor';
import Checkbox from '../../../components/Checkbox';
import TipTrigger from '../../../components/TipTrigger';
import { HEAD_CNC } from '../../../../constants';

const ReliefParameters = ({ disabled }) => {
    const dispatch = useDispatch();
    const invert = useSelector(state => state?.cnc?.modelGroup?.getSelectedModelArray()[0]?.config?.invert);
    const actions = {
        onToggleInvert: () => {
            dispatch(editorActions.updateSelectedModelConfig(HEAD_CNC, { invert: !invert }));
        }
    };

    return (
        <div>
            <React.Fragment>
                <TipTrigger
                    title={i18n._('key_ui/widgets/CNCPath/config/ReliefParameters_Invert')}
                    content={i18n._('key_ui/widgets/CNCPath/config/ReliefParameters_Inverts the color of images, white becomes black, and black becomes white.')}
                >
                    <div className="sm-flex height-32 margin-vertical-8">
                        <span className="sm-flex-width">{i18n._('key_ui/widgets/CNCPath/config/ReliefParameters_Invert')}</span>
                        <Checkbox
                            disabled={disabled}
                            className="sm-flex-auto"
                            defaultChecked={invert}
                            onChange={() => {
                                actions.onToggleInvert();
                                dispatch(editorActions.processSelectedModel(HEAD_CNC));
                            }}
                        />
                    </div>
                </TipTrigger>
            </React.Fragment>
        </div>
    );
};

ReliefParameters.propTypes = {
    disabled: PropTypes.bool
};

export default ReliefParameters;
