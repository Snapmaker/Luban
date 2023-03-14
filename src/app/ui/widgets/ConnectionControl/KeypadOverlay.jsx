import { Tooltip } from 'antd';
import React from 'react';
import i18n from '../../../lib/i18n';


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
        <div
            id="widget-axes-keypad-tooltip"
            style={styles.tooltip}
        >
            <div style={styles.container}>
                <div className="row no-gutters text-left">
                    <div className="col-12">
                        <span style={styles.axisDirection}>X+</span>
                        <kbd style={styles.kbd}>
                            <i className="fa fa-angle-right" style={styles.icon} />
                        </kbd>
                        <span className="space" />
                        {i18n._('key-Workspace/Control/KeypadOverlay-Right')}
                    </div>
                    <div className="col-12">
                        <span style={styles.axisDirection}>X-</span>
                        <kbd style={styles.kbd}>
                            <i className="fa fa-angle-left" style={styles.icon} />
                        </kbd>
                        <span className="space" />
                        {i18n._('key-Workspace/Control/KeypadOverlay-Left')}
                    </div>
                    <div className="col-12">
                        <span style={styles.axisDirection}>Y+</span>
                        <kbd style={styles.kbd}>
                            <i className="fa fa-angle-up" style={styles.icon} />
                        </kbd>
                        <span className="space" />
                        {i18n._('key-Workspace/Control/KeypadOverlay-Up')}
                    </div>
                    <div className="col-12">
                        <span style={styles.axisDirection}>Y-</span>
                        <kbd style={styles.kbd}>
                            <i className="fa fa-angle-down" style={styles.icon} />
                        </kbd>
                        <span className="space" />
                        {i18n._('key-Workspace/Control/KeypadOverlay-Down')}
                    </div>
                    <div className="col-12">
                        <span style={styles.axisDirection}>Z+</span>
                        <kbd style={styles.kbd}>
                            <i className="fa fa-long-arrow-up" style={styles.icon} />
                        </kbd>
                        <span className="space" />
                        {i18n._('key-Workspace/Control/KeypadOverlay-Page Up')}
                    </div>
                    <div className="col-12">
                        <span style={styles.axisDirection}>Z-</span>
                        <kbd style={styles.kbd}>
                            <i className="fa fa-long-arrow-down" style={styles.icon} />
                        </kbd>
                        <span className="space" />
                        {i18n._('key-Workspace/Control/KeypadOverlay-Page Down')}
                    </div>
                </div>
                <div className="row no-gutters">
                    <div style={styles.divider} />
                </div>
                <div className="row no-gutters">
                    <div className="col-12">
                        <div className="table-form">
                            <div className="table-form-row table-form-row-dense">
                                <div className="table-form-col table-form-col-label">{i18n._('key-Workspace/Control/KeypadOverlay-0.1x Move')}</div>
                                <div className="table-form-col">
                                    <kbd style={styles.kbd}>{i18n._('key-Workspace/Control/KeypadOverlay-Alt')}</kbd>
                                </div>
                            </div>
                            <div className="table-form-row table-form-row-dense">
                                <div className="table-form-col table-form-col-label">{i18n._('key-Workspace/Control/KeypadOverlay-10x Move')}</div>
                                <div className="table-form-col">
                                    <kbd style={styles.kbd}>{i18n._('key-Workspace/Control/KeypadOverlay-⇧ Shift')}</kbd>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default (props) => {
    const { show, children } = { ...props };

    if (!show) {
        return children;
    }

    return (
        <Tooltip
            title={keypadTooltip()}
            placement="bottom"
        >
            {children}
        </Tooltip>
    );
};
