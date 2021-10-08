import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import i18n from '../../../lib/i18n';
import Anchor from '../../components/Anchor';
import styles from '../CncLaserShared/styles.styl';
import ReliefParameters from './config/ReliefParameters';
import SvgIcon from '../../components/SvgIcon';
import Checkbox from '../../components/Checkbox';
import TipTrigger from '../../components/TipTrigger';
import { PROCESS_MODE_GREYSCALE, SOURCE_TYPE_SVG } from '../../../constants';

const ImageProcessMode = ({ changeSelectedModelMode, changeSelectedModelShowOrigin, disabled }) => {
    const showOrigin = useSelector(state => state?.cnc?.modelGroup?.getSelectedModel()?.showOrigin);
    const mode = useSelector(state => state?.cnc?.modelGroup?.getSelectedModel()?.mode);
    const sourceType = useSelector(state => state?.cnc?.modelGroup?.getSelectedModel()?.sourceType);
    const originalName = useSelector(state => state?.cnc?.modelGroup?.getSelectedModel()?.originalName);
    const [expanded, setExpanded] = useState(true);
    const isGreyscale = mode === PROCESS_MODE_GREYSCALE;
    const isSvg = sourceType === SOURCE_TYPE_SVG;
    const isDXF = (originalName ? (originalName.substr(originalName.length - 4, 4).toLowerCase() === '.dxf') : false);

    const actions = {
        onToggleExpand: () => {
            setExpanded(!expanded);
        },
        changeSelectedModelMode: (newMode) => {
            changeSelectedModelMode(sourceType, newMode);
        }
    };

    return (
        <React.Fragment>
            <div className={classNames(styles['cnc-mode'], 'border-top-normal', 'margin-top-16')}>
                <Anchor className="sm-flex height-32 margin-vertical-8" onClick={actions.onToggleExpand}>
                    <span className="sm-flex-width heading-3">{i18n._('key_ui/widgets/CNCPath/ImageProcessMode_Processing Mode')}</span>
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
                        <div className={classNames('sm-flex', 'margin-vertical-8', 'align-c', 'justify-space-between', 'width-percent-50')}>
                            { !isDXF && (
                                <div className={classNames(mode === 'greyscale' ? styles.selected : styles.unselected)}>
                                    <Anchor
                                        disabled={disabled}
                                        onClick={() => actions.changeSelectedModelMode('greyscale')}
                                    >
                                        <i className={styles['cnc-mode__icon-greyscale']} />
                                    </Anchor>
                                    <span>{i18n._('key_ui/widgets/CNCPath/ImageProcessMode_RELIEF')}</span>
                                </div>
                            )}
                            {isSvg && (
                                <div className={classNames(mode === 'vector' ? styles.selected : styles.unselected)}>
                                    <Anchor
                                        disabled={disabled}
                                        onClick={() => actions.changeSelectedModelMode('vector')}
                                    >
                                        <i className={styles['cnc-mode__icon-vector']} />
                                    </Anchor>
                                    <span>{i18n._('key_ui/widgets/CNCPath/ImageProcessMode_VECTOR')}</span>
                                </div>
                            )}
                        </div>
                        <TipTrigger
                            title={i18n._('key_ui/widgets/CNCPath/ImageProcessMode_Show Original Image')}
                            content={i18n._('key_ui/widgets/CNCPath/ImageProcessMode_Shows the original image.')}
                        >
                            <div className="sm-flex height-32 margin-vertical-8">
                                <span className="sm-flex-width">{i18n._('key_ui/widgets/CNCPath/ImageProcessMode_Show Original Image')}</span>
                                <Checkbox
                                    disabled={disabled}
                                    className="sm-flex-auto"
                                    checked={showOrigin}
                                    onChange={changeSelectedModelShowOrigin}
                                />
                            </div>
                        </TipTrigger>
                        {isGreyscale && (
                            <ReliefParameters disabled={disabled} />
                        )}
                    </React.Fragment>
                )}
            </div>
        </React.Fragment>
    );
};

ImageProcessMode.propTypes = {
    disabled: PropTypes.bool,

    changeSelectedModelMode: PropTypes.func.isRequired,
    changeSelectedModelShowOrigin: PropTypes.func.isRequired
};

export default ImageProcessMode;
