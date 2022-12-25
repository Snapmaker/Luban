import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';
import i18n from '../../../lib/i18n';
import Checkbox from '../../components/Checkbox';

import { HEAD_CNC, DISPLAYED_TYPE_TOOLPATH } from '../../../constants';
import { actions as editorActions } from '../../../flux/editor';
import styles from './styles.styl';

const VisualizerTopRight = ({ headType }) => {
    const displayedType = useSelector(state => state[headType]?.displayedType);
    const showToolPath = useSelector(state => state[headType]?.showToolPath);
    const showSimulation = useSelector(state => state[headType]?.showSimulation);
    const canGenerateGcode = useSelector(state => state[headType]?.toolPathGroup?.canGenerateGcode());
    const simulationNeedToPreview = useSelector(state => state[headType]?.simulationNeedToPreview);

    const dispatch = useDispatch();

    const actions = {
        switchToEditPage: () => {
            if (displayedType === DISPLAYED_TYPE_TOOLPATH) {
                dispatch(editorActions.showModelGroupObject(headType));
            } else {
                dispatch(editorActions.showToolPathGroupObject(headType));
            }
        },
        switchShowToolPath: () => {
            dispatch(editorActions.showToolpathInPreview(headType, !showToolPath));
        },
        switchShowSimulation: () => {
            if (showSimulation) {
                dispatch(editorActions.showSimulationInPreview(headType, !showSimulation));
                return;
            }
            if (canGenerateGcode) {
                if (simulationNeedToPreview) {
                    dispatch(editorActions.commitGenerateViewPath(headType));
                } else {
                    dispatch(editorActions.showSimulationInPreview(headType, !showSimulation));
                }
            }
        }
    };

    useEffect(() => {
        if (canGenerateGcode === false) {
            dispatch(editorActions.showSimulationInPreview(headType, false));
        }
    }, [canGenerateGcode]);

    return (
        <React.Fragment>
            <div>
                {headType === HEAD_CNC && (
                    <div
                        className={classNames(
                            styles['visualizer-top-right'],
                            'position-absolute',
                            'right-8',
                            'width-200',
                            'border-default-grey-1',
                            'border-radius-8',
                            'background-color-white',
                        )}
                    >
                        <div className="border-bottom-normal padding-vertical-8 padding-horizontal-16 height-40">
                            {i18n._('key-CncLaser/Preview-Preview Type')}
                        </div>
                        <div className="padding-vertical-16 padding-horizontal-16">
                            <div className="sm-flex justify-space-between height-24">
                                <span>
                                    {i18n._('key-CncLaser/Preview-Toolpath')}
                                </span>
                                <Checkbox
                                    onChange={actions.switchShowToolPath}
                                    checked={showToolPath}
                                />
                            </div>
                            <div className="sm-flex justify-space-between height-24 margin-top-16">
                                <span>
                                    {i18n._('key-CncLaser/Preview-Simulation')}
                                </span>
                                <Checkbox
                                    onChange={actions.switchShowSimulation}
                                    checked={showSimulation}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </React.Fragment>
    );
};

VisualizerTopRight.propTypes = {
    headType: PropTypes.string.isRequired
};

export default VisualizerTopRight;
