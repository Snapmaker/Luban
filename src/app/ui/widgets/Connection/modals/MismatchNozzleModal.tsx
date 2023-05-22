import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import {
    LEFT_EXTRUDER,
    RIGHT_EXTRUDER
} from '../../../../constants';
import { isDualExtruder } from '../../../../constants/machines';
import { RootState } from '../../../../flux/index.def';
import { actions as printingActions } from '../../../../flux/printing';
import i18n from '../../../../lib/i18n';
import { Button } from '../../../components/Buttons';
import Modal from '../../../components/Modal';


const MismatchNozzleModal: React.FC = () => {
    // connected
    const { isConnected } = useSelector((state: RootState) => state.workspace);

    const { toolHead, nozzleSizeList } = useSelector((state: RootState) => state.workspace, shallowEqual);

    const {
        extruderLDefinition,
        extruderRDefinition,
    } = useSelector((state: RootState) => state.printing);

    // const leftDiameter = extruderLDefinition?.settings.machine_nozzle_size.default_value;
    // const rightDiameter = extruderRDefinition?.settings.machine_nozzle_size.default_value;

    const [showNozzleModal, setshowNozzleModal] = useState(false);
    const dispatch = useDispatch();

    const hideNozzleModal = useCallback(() => {
        setshowNozzleModal(false);
    }, []);

    const setDiameter = useCallback((direction, value) => {
        dispatch(
            printingActions.updateMachineDefinition({
                direction,
                paramKey: 'machine_nozzle_size',
                paramValue: value,
            })
        );
    }, [dispatch]);

    const nozzleSizeListJSON = useMemo(() => JSON.stringify(nozzleSizeList), [nozzleSizeList]);

    // Confirm the change
    const onConfirmChange = useCallback(() => {
        const leftDiameter = extruderLDefinition?.settings.machine_nozzle_size.default_value;
        const rightDiameter = extruderRDefinition?.settings.machine_nozzle_size.default_value;

        const activeNozzleSize = JSON.parse(nozzleSizeListJSON);

        if (activeNozzleSize[0] && leftDiameter !== activeNozzleSize[0]) {
            setDiameter(LEFT_EXTRUDER, activeNozzleSize[0]);
        }

        if (activeNozzleSize[1] && rightDiameter !== activeNozzleSize[1]) {
            setDiameter(RIGHT_EXTRUDER, activeNozzleSize[1]);
        }

        hideNozzleModal();
    }, [
        extruderLDefinition?.settings.machine_nozzle_size.default_value,
        extruderRDefinition?.settings.machine_nozzle_size.default_value,
        nozzleSizeListJSON,
        setDiameter, hideNozzleModal,
    ]);

    useEffect(() => {
        if (isConnected) {
            const leftDiameter = extruderLDefinition?.settings.machine_nozzle_size.default_value;
            const rightDiameter = extruderRDefinition?.settings.machine_nozzle_size.default_value;

            const activeNozzleSize = JSON.parse(nozzleSizeListJSON);

            if (isDualExtruder(toolHead)) {
                let mismatch = false;
                if (activeNozzleSize[0] && leftDiameter && leftDiameter !== activeNozzleSize[0]) {
                    mismatch = true;
                }
                if (activeNozzleSize[1] && rightDiameter && rightDiameter !== activeNozzleSize[1]) {
                    mismatch = true;
                }

                setshowNozzleModal(mismatch);
            } else {
                let mismatch = false;
                // For SM 2.0, activeNozzleSize is not available
                if (activeNozzleSize[0] && leftDiameter && leftDiameter !== activeNozzleSize[0]) {
                    mismatch = true;
                }
                setshowNozzleModal(mismatch);
            }
        }
    }, [
        extruderLDefinition?.settings.machine_nozzle_size.default_value,
        extruderRDefinition?.settings.machine_nozzle_size.default_value,
        isConnected,
        toolHead, nozzleSizeListJSON,
    ]);

    const leftNozzleSize = extruderLDefinition?.settings.machine_nozzle_size.default_value;
    const rightNozzleSize = extruderRDefinition?.settings.machine_nozzle_size.default_value;

    return (
        <div>
            {
                showNozzleModal && (
                    <Modal
                        onClose={hideNozzleModal}
                        style={{
                            borderRadius: '8px'
                        }}
                    >
                        <Modal.Header>
                            {i18n._('key-Workspace/Mismatch-Synchronize_Nozzle_Diameter')}
                        </Modal.Header>
                        <Modal.Body style={{ maxWidth: '432px' }}>
                            {i18n._('key-Workspace/Mismatch-The configured Nozzle Diameter ({{diameterInfo}}) is inconsistent with that of the connected machine ({{connectedDameterInfo}}). Luban will update the configuration to be consistent with the machine nozzle.',
                                {
                                    diameterInfo: isDualExtruder(toolHead) ? `L: ${leftNozzleSize}mm; R: ${rightNozzleSize}mm` : `L: ${leftNozzleSize}mm`,
                                    connectedDameterInfo: isDualExtruder(toolHead) ? `L: ${nozzleSizeList[0]}mm; R: ${nozzleSizeList[1]}mm` : `L: ${nozzleSizeList[0]}mm`,
                                })}
                        </Modal.Body>
                        <Modal.Footer>
                            <Button
                                type="default"
                                priority="level-two"
                                className="margin-left-8"
                                width="96px"
                                onClick={hideNozzleModal}
                            >
                                {i18n._('key-Modal/Common-Cancel')}
                            </Button>
                            <Button
                                type="primary"
                                priority="level-two"
                                className="margin-left-8"
                                width="96px"
                                onClick={onConfirmChange}
                            >
                                {i18n._('key-Modal/Common-Confirm')}
                            </Button>
                        </Modal.Footer>
                    </Modal>
                )
            }
        </div>
    );
};

export default MismatchNozzleModal;
