import React from 'react';
import PropTypes from 'prop-types';
import { renderModal } from '../../utils';
import i18n from '../../../lib/i18n';
import JobType from '../../widgets/JobType';
import { actions as editorActions } from '../../../flux/editor';

function renderJobTypeModal(headType, dispatch, showJobType, setShowJobType, jobTypeState, setJobTypeState, coordinateMode, coordinateSize, materials) {
    return showJobType && renderModal({
        title: i18n._('Job Setup'),
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
                name: i18n._('Cancel'),
                onClick: () => {
                    setJobTypeState({
                        coordinateMode,
                        coordinateSize,
                        materials
                    });
                    setShowJobType(false);
                }
            },
            {
                name: i18n._('Confirm'),
                isPrimary: true,
                onClick: () => {
                    dispatch(editorActions.changeCoordinateMode(headType,
                        jobTypeState.coordinateMode, jobTypeState.coordinateSize));
                    dispatch(editorActions.updateMaterials(headType, jobTypeState.materials));
                    dispatch(editorActions.scaleCanvasToFit(headType));
                    setShowJobType(false);
                }
            }
        ],
        onClose: () => {
            setJobTypeState({
                coordinateMode,
                coordinateSize,
                materials
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
    materials: PropTypes.object.isRequired
};

export default renderJobTypeModal;
