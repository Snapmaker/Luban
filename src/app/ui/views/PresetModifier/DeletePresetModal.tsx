import React from 'react';

import i18n from '../../../lib/i18n';
import { ModalHOC } from '../../../lib/modal';
import { Button } from '../../components/Buttons';

import { PresetModel } from '../../../preset-model';
import { PresetActionsType } from './usePresetActions';


declare type DeletePresetModalProps = {
    presetModel: PresetModel;

    presetActions: PresetActionsType;

    onClose: () => void;
}

/**
 * Show modal for deleting preset.
 */
const DeletePresetModal: React.FC<DeletePresetModalProps> = (props) => {
    const { presetModel, presetActions, onClose } = props;

    const title = i18n._('key-Printing/ProfileManager-Delete Profile');

    return (
        <ModalHOC
            title={title}
            removeContainer={onClose}
            body={(
                <p>{i18n._('key-ProfileManager-Are you sure to delete profile "{{name}}"?', { name: presetModel.name })}</p>
            )}
            footer={(
                // @ts-ignore
                <Button
                    priority="level-two"
                    className="margin-left-8"
                    width="96px"
                    onClick={async () => {
                        await presetActions.onDeletePresetModel(presetModel); // assume it success

                        onClose();
                    }}
                >
                    {i18n._('key-Printing/ProfileManager-Delete')}
                </Button>
            )}
        />
    );
};


export default DeletePresetModal;
