import React from 'react';

import i18n from '../../../lib/i18n';
import { PresetModel } from '../../../preset-model';
import { Button } from '../../components/Buttons';
import { ModalHOC } from '../../../lib/modal';
import { PresetActionsType } from './usePresetActions';


interface ResetPresetModalProps {
    presetModel: PresetModel;

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
                    onClick={async () => {
                        await presetActions.onResetPresetModel(presetModel); // assume it success

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
