import React from 'react';
import PropTypes from 'prop-types';
import { renderModal } from '../../utils';
import i18n from '../../../lib/i18n';
import JobType from '../../widgets/JobType';
import { actions as editorActions } from '../../../flux/editor';
import { HEAD_CNC } from '../../../constants';

// TODO: Refactor this component
function renderJobTypeModal(
    headType, dispatch, showJobType,
    setShowJobType, jobTypeState, setJobTypeState,
    coordinateMode, coordinateSize, materials,
    useLockingBlock, lockingBlockPosition
) {
    return showJobType && renderModal({
        title: i18n._('key-CncLaser/JobSetup-Job Setup'),
        renderBody() {
            return (
                <JobType
                    isWidget={false}
                    headType={headType}
                    jobTypeState={jobTypeState}
                    setJobTypeState={setJobTypeState}
                />
            );
        },
        actions: [
            {
                name: i18n._('key-CncLaser/JobSetup-Cancel'),
                onClick: () => {
                    setJobTypeState({
                        coordinateMode,
                        coordinateSize,
                        materials,
                        useLockingBlock,
                        lockingBlockPosition
                    });
                    setShowJobType(false);
                }
            },
            {
                name: i18n._('key-CncLaser/JobSetup-Confirm'),
                isPrimary: true,
                onClick: () => {
                    dispatch(editorActions.changeCoordinateMode(headType,
                        jobTypeState.coordinateMode, jobTypeState.coordinateSize));
                    dispatch(editorActions.updateMaterials(headType, jobTypeState.materials));
                    dispatch(editorActions.scaleCanvasToFit(headType));
                    if (headType === HEAD_CNC) {
                        dispatch(editorActions.updateState(HEAD_CNC, {
                            useLockingBlock: jobTypeState.useLockingBlock,
                            lockingBlockPosition: jobTypeState.lockingBlockPosition
                        }));
                    }
                    setShowJobType(false);
                }
            }
        ],
        onClose: () => {
            setJobTypeState({
                coordinateMode,
                coordinateSize,
                materials,
                useLockingBlock,
                lockingBlockPosition
            });
            setShowJobType(false);
        }
    });
}

renderJobTypeModal.propTypes = {
    headType: PropTypes.string.isRequired,
    showJobType: PropTypes.bool.isRequired,
    setShowJobType: PropTypes.func.isRequired,
    jobTypeState: PropTypes.object.isRequired,
    setJobTypeState: PropTypes.func.isRequired,
    coordinateMode: PropTypes.object.isRequired,
    coordinateSize: PropTypes.object.isRequired,
    materials: PropTypes.object.isRequired,
    useLockingBlock: PropTypes.bool,
    lockingBlockPosition: PropTypes.number
};

export default renderJobTypeModal;
