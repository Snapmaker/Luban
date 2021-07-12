import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import i18n from '../../../lib/i18n';
import Anchor from '../../components/Anchor';
import Checkbox from '../../components/Checkbox';
import SvgIcon from '../../components/SvgIcon';
import styles from '../CncLaserShared/styles.styl';
import ConfigRasterBW from './config/ConfigRasterBW';
import ConfigGreyscale from './config/ConfigGreyscale';
import ConfigRasterVector from './config/ConfigRasterVector';
import ConfigHalftone from './config/ConfigHalftone';

class ImageProcessMode extends PureComponent {
    static propTypes = {
        sourceType: PropTypes.string.isRequired,
        mode: PropTypes.string.isRequired,
        showOrigin: PropTypes.bool,
        disabled: PropTypes.bool,

        changeSelectedModelMode: PropTypes.func.isRequired,
        changeSelectedModelShowOrigin: PropTypes.func.isRequired
    };

    state = {
        expanded: true
    };

    actions = {
        onToggleExpand: () => {
            this.setState(state => ({ expanded: !state.expanded }));
        },
        changeSelectedModelMode: (mode) => {
            const { sourceType } = this.props;
            this.props.changeSelectedModelMode(sourceType, mode);
        }
    };

    render() {
        const { sourceType, mode, showOrigin, disabled } = this.props;
        const actions = this.actions;
        const isBW = mode === 'bw';
        const isGreyscale = mode === 'greyscale';
        const isRasterVector = sourceType === 'raster' && mode === 'vector';
        const isHalftone = mode === 'halftone';

        return (
            <React.Fragment>
                <div className={styles['laser-mode']}>
                    <Anchor className="sm-flex height-32 margin-vertical-8" onClick={this.actions.onToggleExpand}>
                        <span className="sm-flex-width">{i18n._('Processing Mode')}</span>
                        <SvgIcon
                            name="DropdownLine"
                            className={classNames(
                                this.state.expanded ? '' : 'rotate180'
                            )}
                        />
                    </Anchor>
                    {this.state.expanded && (
                        <React.Fragment>
                            <div className={classNames('sm-flex', 'margin-vertical-8', 'align-c', 'justify-space-between')}>
                                <div className={classNames(this.props.mode === 'bw' ? styles.selected : styles.unselected)}>
                                    <Anchor
                                        disabled={disabled}
                                        onClick={() => actions.changeSelectedModelMode('bw')}
                                    >
                                        <i className={styles['laser-mode__icon-bw']} />
                                    </Anchor>
                                    <span>{i18n._('B&W')}</span>
                                </div>
                                <div className={classNames(this.props.mode === 'greyscale' ? styles.selected : styles.unselected)}>
                                    <Anchor
                                        disabled={disabled}
                                        onClick={() => actions.changeSelectedModelMode('greyscale')}
                                    >
                                        <i className={styles['laser-mode__icon-greyscale']} />
                                    </Anchor>
                                    <span>{i18n._('GREYSCALE')}</span>
                                </div>
                                <div className={classNames(this.props.mode === 'vector' ? styles.selected : styles.unselected)}>
                                    <Anchor
                                        disabled={disabled}
                                        onClick={() => actions.changeSelectedModelMode('vector')}
                                    >
                                        <i className={styles['laser-mode__icon-vector']} />
                                    </Anchor>
                                    <span>{i18n._('VECTOR')}</span>
                                </div>
                                <div className={classNames(this.props.mode === 'halftone' ? styles.selected : styles.unselected)}>
                                    <Anchor
                                        disabled={disabled}
                                        onClick={() => actions.changeSelectedModelMode('halftone')}
                                    >
                                        <i className={styles['laser-mode__icon-halftone']} />
                                    </Anchor>
                                    <span>{i18n._('HALFTONE')}</span>
                                </div>
                            </div>
                            <div className="sm-flex height-32 margin-vertical-8">
                                <span className="sm-flex-width">{i18n._('Show Original Image')}</span>
                                <Checkbox
                                    disabled={disabled}
                                    className="sm-flex-auto"
                                    checked={showOrigin}
                                    onChange={this.props.changeSelectedModelShowOrigin}
                                />
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
    }
}


export default ImageProcessMode;
