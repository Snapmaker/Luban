import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import i18n from '../../../lib/i18n';
import Anchor from '../../components/Anchor';
import styles from '../CncLaserShared/styles.styl';
import ReliefParameters from './config/ReliefParameters';
import SvgIcon from '../../components/SvgIcon';
import Checkbox from '../../components/Checkbox';

class ImageProcessMode extends PureComponent {
    static propTypes = {
        sourceType: PropTypes.string.isRequired,
        mode: PropTypes.string.isRequired,
        showOrigin: PropTypes.bool,
        disabled: PropTypes.bool,
        isDXF: PropTypes.bool,

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
        const { sourceType, mode, showOrigin, disabled, isDXF } = this.props;
        const actions = this.actions;
        const isGreyscale = mode === 'greyscale';
        const isSvg = sourceType === 'svg';

        return (
            <React.Fragment>
                <div className={styles['cnc-mode']}>
                    <Anchor className="sm-flex height-32 margin-vertical-8" onClick={this.actions.onToggleExpand}>
                        <span className="sm-flex-width heading-3">{i18n._('Processing Mode')}</span>
                        <SvgIcon
                            name="DropdownLine"
                            size={32}
                            className={classNames(
                                this.state.expanded ? '' : 'rotate180'
                            )}
                        />
                    </Anchor>
                    {this.state.expanded && (
                        <React.Fragment>
                            <div className={classNames('sm-flex', 'margin-vertical-8', 'align-c', 'justify-space-between', 'width-percent-50')}>
                                { !isDXF && (
                                    <div className={classNames(this.props.mode === 'greyscale' ? styles.selected : styles.unselected)}>
                                        <Anchor
                                            disabled={disabled}
                                            onClick={() => actions.changeSelectedModelMode('greyscale')}
                                        >
                                            <i className={styles['cnc-mode__icon-greyscale']} />
                                        </Anchor>
                                        <span>{i18n._('RELIEF')}</span>
                                    </div>
                                )}
                                {isSvg && (
                                    <div className={classNames(this.props.mode === 'vector' ? styles.selected : styles.unselected)}>
                                        <Anchor
                                            disabled={disabled}
                                            onClick={() => actions.changeSelectedModelMode('vector')}
                                        >
                                            <i className={styles['cnc-mode__icon-vector']} />
                                        </Anchor>
                                        <span>{i18n._('VECTOR')}</span>
                                    </div>
                                )}
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
                            {isGreyscale && (
                                <ReliefParameters disabled={disabled} />
                            )}
                        </React.Fragment>
                    )}
                </div>
            </React.Fragment>
        );
    }
}


export default ImageProcessMode;
