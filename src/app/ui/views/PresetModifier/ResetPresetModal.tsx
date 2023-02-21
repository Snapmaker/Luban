import React from 'react';

import i18n from '../../../lib/i18n';
import PresetDefinitionModel from '../../../flux/manager/PresetDefinitionModel';
import { Button } from '../../components/Buttons';
import { ModalHOC } from '../../../lib/modal';
import { PresetActionsType } from './usePresetActions';


interface ResetPresetModalProps {
    presetModel: PresetDefinitionModel;

    presetActions: PresetActionsType;

    onClose: () => void;
}

const ResetPresetModal: React.FC<ResetPresetModalProps> = (props) => {
    const { presetModel, presetActions, onClose } = props;
    const title = i18n._('key-Printing/ProfileManager-Reset Profile');

    return (
        <ModalHOC
            title={title}
            removeContainer={onClose}
            body={(
                <p>{i18n._('key-ProfileManager-Are you sure to reset profile "{{name}}"?', { name: presetModel.name })}</p>
            )}
            footer={(

                // @ts-ignore
                <Button
                    priority="level-two"
                    className="margin-left-8"
                    width="96px"
                    onClick={() => {
                        // await presetActions.onDeletePresetModel(presetModel); // assume it success
                        console.log(presetActions);

                        onClose();
                    }}
                >
                    {i18n._('key-Printing/ProfileManager-Reset')}
                </Button>

            )}
        />
    );
};

export default ResetPresetModal;
