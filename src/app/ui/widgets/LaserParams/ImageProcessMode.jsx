import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import i18n from '../../../lib/i18n';
import Anchor from '../../components/Anchor';
// import Checkbox from '../../components/Checkbox';
import SvgIcon from '../../components/SvgIcon';
import styles from '../CncLaserShared/styles.styl';
import ConfigRasterBW from './config/ConfigRasterBW';
import ConfigGreyscale from './config/ConfigGreyscale';
import ConfigRasterVector from './config/ConfigRasterVector';
import ConfigHalftone from './config/ConfigHalftone';
// import TipTrigger from '../../components/TipTrigger';
import { actions as editorActions } from '../../../flux/editor';
import { HEAD_LASER, PROCESS_MODE_GREYSCALE, PROCESS_MODE_BW, SOURCE_TYPE, PROCESS_MODE_VECTOR, PROCESS_MODE_HALFTONE } from '../../../constants';

const ImageProcessMode = ({ disabled }) => {
    const dispatch = useDispatch();

    const sourceType = useSelector(state => state?.laser?.modelGroup?.getSelectedModel()?.sourceType);
    const mode = useSelector(state => state?.laser?.modelGroup?.getSelectedModel()?.mode);
    const originalName = useSelector(state => state?.laser?.modelGroup?.getSelectedModel()?.originalName);
    const isBW = mode === PROCESS_MODE_BW;
    const isGreyscale = mode === PROCESS_MODE_GREYSCALE;
    const isRasterVector = sourceType === SOURCE_TYPE.RASTER && mode === PROCESS_MODE_VECTOR;
    const isHalftone = mode === PROCESS_MODE_HALFTONE;
    const isDXF = (originalName ? (originalName.substr(originalName.length - 4, 4).toLowerCase() === '.dxf') : false);

    const [expanded, setExpanded] = useState(true);

    const actions = {
        onToggleExpand: () => {
            setExpanded(!expanded);
        },
        changeSelectedModelMode: (newMode) => {
            dispatch(editorActions.changeSelectedModelMode(HEAD_LASER, sourceType, newMode));
        }
    };

    return (
        <React.Fragment>
            <div className={classNames(styles['laser-mode'], 'border-top-normal', 'margin-top-16', 'margin-bottom-8')}>
                <Anchor className="sm-flex height-32 margin-vertical-8" onClick={actions.onToggleExpand}>
                    <span className="sm-flex-width heading-3">{i18n._('key-Laser/ProcessingModeSection/ImageProcessMode-Processing Mode')}</span>
                    <SvgIcon
                        name="DropdownLine"
                        size={24}
                        type={['static']}
                        className={classNames(
                            expanded ? '' : 'rotate180'
                        )}
                    />
                </Anchor>
                {expanded && (
                    <React.Fragment>
                        <div className={classNames('sm-flex', 'margin-vertical-8', 'align-c', 'justify-space-between')}>
                            {!isDXF && (
                                <div className={classNames(mode === 'bw' ? styles.selected : styles.unselected)}>
                                    <Anchor
                                        disabled={disabled}
                                        onClick={() => actions.changeSelectedModelMode('bw')}
                                    >
                                        <i className={styles['laser-mode__icon-bw']} />
                                    </Anchor>
                                    <span className="max-width-76 text-overflow-ellipsis-line-2">{i18n._('key-Laser/ProcessingModeSection/ImageProcessMode-B&W')}</span>
                                </div>
                            )}
                            {!isDXF && (
                                <div className={classNames(mode === 'greyscale' ? styles.selected : styles.unselected)}>
                                    <Anchor
                                        disabled={disabled}
                                        onClick={() => actions.changeSelectedModelMode('greyscale')}
                                    >
                                        <i className={styles['laser-mode__icon-greyscale']} />
                                    </Anchor>
                                    <span className="max-width-76 text-overflow-ellipsis-line-2">{i18n._('key-Laser/ProcessingModeSection/ImageProcessMode-GREYSCALE')}</span>
                                </div>
                            )}
                            <div className={classNames(mode === 'vector' ? styles.selected : styles.unselected)}>
                                <Anchor
                                    disabled={disabled}
                                    onClick={() => actions.changeSelectedModelMode('vector')}
                                >
                                    <i className={styles['laser-mode__icon-vector']} />
                                </Anchor>
                                <span className="max-width-76 text-overflow-ellipsis-line-2">{i18n._('key-Laser/ProcessingModeSection/ImageProcessMode-VECTOR')}</span>
                            </div>
                            {!isDXF && (
                                <div className={classNames(mode === 'halftone' ? styles.selected : styles.unselected)}>
                                    <Anchor
                                        disabled={disabled}
                                        onClick={() => actions.changeSelectedModelMode('halftone')}
                                    >
                                        <i className={styles['laser-mode__icon-halftone']} />
                                    </Anchor>
                                    <span className="max-width-76 text-overflow-ellipsis-line-2">{i18n._('key-Laser/ProcessingModeSection/ImageProcessMode-HALFTONE')}</span>
                                </div>
                            )}
                        </div>
                        {isBW && <ConfigRasterBW disabled={disabled} />}
                        {isGreyscale && <ConfigGreyscale disabled={disabled} />}
                        {isRasterVector && <ConfigRasterVector disabled={disabled} />}
                        {isHalftone && <ConfigHalftone disabled={disabled} />}
                    </React.Fragment>
                )}
            </div>

        </React.Fragment>
    );
};

ImageProcessMode.propTypes = {
    disabled: PropTypes.bool
};

export default ImageProcessMode;
