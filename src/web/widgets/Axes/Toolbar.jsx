import classNames from 'classnames';
import React, { Component, PropTypes } from 'react';
import shallowCompare from 'react-addons-shallow-compare';
import { Tooltip, OverlayTrigger } from 'react-bootstrap';
import i18n from '../../lib/i18n';
import styles from './index.styl';

const keypadTooltip = () => {
    const styles = {
        tooltip: {
            fontFamily: 'Consolas, Menlo, Monaco, Lucida Console, Liberation Mono, DejaVu Sans Mono, Bitstream Vera Sans Mono, Courier New, monospace, serif',
            padding: 5
        },
        container: {
            padding: 5
        },
        axisDirection: {
            marginRight: 10
        },
        divider: {
            borderTop: '1px solid #ccc',
            marginTop: 5,
            paddingTop: 5
        },
        kbd: {
            border: '1px solid #aaa',
            padding: '1px 4px',
            fontFamily: 'sans-serif',
            whiteSpace: 'nowrap'
        },
        icon: {
            minWidth: 10,
            textAlign: 'center'
        }
    };

    return (
        <Tooltip
            id="widget-axes-keypad-tooltip"
            style={styles.tooltip}
        >
            <div style={styles.container}>
                <div className="row no-gutters text-left">
                    <div className="col-xs-12">
                        <span style={styles.axisDirection}>X+</span>
                        <kbd style={styles.kbd}>
                            <i className="fa fa-angle-right" style={styles.icon} />
                        </kbd>
                        <span className="space" />
                        {i18n._('Right')}
                    </div>
                    <div className="col-xs-12">
                        <span style={styles.axisDirection}>X-</span>
                        <kbd style={styles.kbd}>
                            <i className="fa fa-angle-left" style={styles.icon} />
                        </kbd>
                        <span className="space" />
                        {i18n._('Left')}
                    </div>
                    <div className="col-xs-12">
                        <span style={styles.axisDirection}>Y+</span>
                        <kbd style={styles.kbd}>
                            <i className="fa fa-angle-up" style={styles.icon} />
                        </kbd>
                        <span className="space" />
                        {i18n._('Up')}
                    </div>
                    <div className="col-xs-12">
                        <span style={styles.axisDirection}>Y-</span>
                        <kbd style={styles.kbd}>
                            <i className="fa fa-angle-down" style={styles.icon} />
                        </kbd>
                        <span className="space" />
                        {i18n._('Down')}
                    </div>
                    <div className="col-xs-12">
                        <span style={styles.axisDirection}>Z+</span>
                        <kbd style={styles.kbd}>
                            <i className="fa fa-long-arrow-up" style={styles.icon} />
                        </kbd>
                        <span className="space" />
                        {i18n._('Page Up')}
                    </div>
                    <div className="col-xs-12">
                        <span style={styles.axisDirection}>Z-</span>
                        <kbd style={styles.kbd}>
                            <i className="fa fa-long-arrow-down" style={styles.icon} />
                        </kbd>
                        <span className="space" />
                        {i18n._('Page Down')}
                    </div>
                </div>
                <div className="row no-gutters">
                    <div style={styles.divider} />
                </div>
                <div className="row no-gutters">
                    <div className="col-xs-12">
                        <div className="table-form">
                            <div className="table-form-row table-form-row-dense">
                                <div className="table-form-col table-form-col-label">{i18n._('0.1x Move')}</div>
                                <div className="table-form-col">
                                    <kbd style={styles.kbd}>{i18n._('Alt')}</kbd>
                                </div>
                            </div>
                            <div className="table-form-row table-form-row-dense">
                                <div className="table-form-col table-form-col-label">{i18n._('10x Move')}</div>
                                <div className="table-form-col">
                                    <kbd style={styles.kbd}>{i18n._('⇧ Shift')}</kbd>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Tooltip>
    );
};

class ToolbarButton extends Component {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };

    shouldComponentUpdate(nextProps, nextState) {
        return shallowCompare(this, nextProps, nextState);
    }
    render() {
        const { state, actions } = this.props;
        const { canClick, keypadJogging } = state;

        return (
            <div
                className={classNames(
                    'clearfix',
                    styles['toolbar-button']
                )}
            >
                <div className="btn-group pull-left">
                    {(canClick && keypadJogging) &&
                    <OverlayTrigger
                        overlay={keypadTooltip()}
                        placement="bottom"
                        delayShow={0}
                    >
                        <button
                            type="button"
                            className={classNames(
                                'btn',
                                'btn-xs',
                                'btn-default',
                                { 'btn-select': keypadJogging }
                            )}
                            onClick={actions.toggleKeypadJogging}
                            disabled={!canClick}
                        >
                            <i className="fa fa-keyboard-o" />
                            <span className="space" />
                            {i18n._('Keypad')}
                        </button>
                    </OverlayTrigger>
                    }
                    {!(canClick && keypadJogging) &&
                    <button
                        type="button"
                        className={classNames(
                            'btn',
                            'btn-xs',
                            'btn-default',
                            { 'btn-select': keypadJogging }
                        )}
                        onClick={actions.toggleKeypadJogging}
                        disabled={!canClick}
                    >
                        <i className="fa fa-keyboard-o" />
                        <span className="space" />
                        {i18n._('Keypad')}
                    </button>
                    }
                </div>

            </div>
        );
    }
}

export default ToolbarButton;
