import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
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
                <Anchor className="sm-parameter-header" onClick={this.actions.onToggleExpand}>
                    <span className="fa fa-arrows-alt sm-parameter-header__indicator" />
                    <span className="sm-parameter-header__title">{i18n._('Processing Mode')}</span>
                    <span className={classNames(
                        'fa',
                        this.state.expanded ? 'fa-angle-double-up' : 'fa-angle-double-down',
                        'sm-parameter-header__indicator',
                        'pull-right',
                    )}
                    />
                </Anchor>
                {this.state.expanded && (
                    <React.Fragment>
                        <div style={{
                            margin: '15px 0px'
                        }}
                        >
                            <div className={styles['laser-modes']}>
                                <div className={classNames(styles['laser-mode'], { [styles.selected]: this.props.mode === 'bw' })}>
                                    <Anchor

                                        disabled={disabled}
                                        className={styles['laser-mode__btn']}
                                        onClick={() => actions.changeSelectedModelMode('bw')}
                                    >
                                        <i className={styles['laser-mode__icon-bw']} />
                                    </Anchor>
                                    <span className={styles['laser-mode__text']}>{i18n._('B&W')}</span>
                                </div>
                                <div className={classNames(styles['laser-mode'], { [styles.selected]: this.props.mode === 'greyscale' })}>
                                    <Anchor
                                        disabled={disabled}
                                        className={styles['laser-mode__btn']}
                                        onClick={() => actions.changeSelectedModelMode('greyscale')}
                                    >
                                        <i className={styles['laser-mode__icon-greyscale']} />
                                    </Anchor>
                                    <span className={styles['laser-mode__text']}>{i18n._('GREYSCALE')}</span>
                                </div>
                                <div className={classNames(styles['laser-mode'], { [styles.selected]: this.props.mode === 'vector' })}>
                                    <Anchor
                                        disabled={disabled}
                                        className={styles['laser-mode__btn']}
                                        onClick={() => actions.changeSelectedModelMode('vector')}
                                    >
                                        <i className={styles['laser-mode__icon-vector']} />
                                    </Anchor>
                                    <span className={styles['laser-mode__text']}>{i18n._('VECTOR')}</span>
                                </div>
                                <div className={classNames(styles['laser-mode'], { [styles.selected]: this.props.mode === 'halftone' })}>
                                    <Anchor
                                        disabled={disabled}
                                        className={styles['laser-mode__btn']}
                                        onClick={() => actions.changeSelectedModelMode('halftone')}
                                    >
                                        <i className={styles['laser-mode__icon-halftone']} />
                                    </Anchor>
                                    <span className={styles['laser-mode__text']}>{i18n._('HALFTONE')}</span>
                                </div>
                            </div>
                        </div>
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label-lg">{i18n._('Show Original Image')}</span>
                            <input
                                disabled={disabled}
                                type="checkbox"
                                className="sm-parameter-row__checkbox"
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
            </React.Fragment>
        );
    }
}


export default ImageProcessMode;
