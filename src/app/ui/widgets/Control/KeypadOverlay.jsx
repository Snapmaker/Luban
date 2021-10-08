import React from 'react';
import { Tooltip, OverlayTrigger } from 'react-bootstrap';
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
        <Tooltip
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
                        {i18n._('key_ui/widgets/Control/KeypadOverlay_Right')}
                    </div>
                    <div className="col-12">
                        <span style={styles.axisDirection}>X-</span>
                        <kbd style={styles.kbd}>
                            <i className="fa fa-angle-left" style={styles.icon} />
                        </kbd>
                        <span className="space" />
                        {i18n._('key_ui/widgets/Control/KeypadOverlay_Left')}
                    </div>
                    <div className="col-12">
                        <span style={styles.axisDirection}>Y+</span>
                        <kbd style={styles.kbd}>
                            <i className="fa fa-angle-up" style={styles.icon} />
                        </kbd>
                        <span className="space" />
                        {i18n._('key_ui/widgets/Control/KeypadOverlay_Up')}
                    </div>
                    <div className="col-12">
                        <span style={styles.axisDirection}>Y-</span>
                        <kbd style={styles.kbd}>
                            <i className="fa fa-angle-down" style={styles.icon} />
                        </kbd>
                        <span className="space" />
                        {i18n._('key_ui/widgets/Control/KeypadOverlay_Down')}
                    </div>
                    <div className="col-12">
                        <span style={styles.axisDirection}>Z+</span>
                        <kbd style={styles.kbd}>
                            <i className="fa fa-long-arrow-up" style={styles.icon} />
                        </kbd>
                        <span className="space" />
                        {i18n._('key_ui/widgets/Control/KeypadOverlay_Page Up')}
                    </div>
                    <div className="col-12">
                        <span style={styles.axisDirection}>Z-</span>
                        <kbd style={styles.kbd}>
                            <i className="fa fa-long-arrow-down" style={styles.icon} />
                        </kbd>
                        <span className="space" />
                        {i18n._('key_ui/widgets/Control/KeypadOverlay_Page Down')}
                    </div>
                </div>
                <div className="row no-gutters">
                    <div style={styles.divider} />
                </div>
                <div className="row no-gutters">
                    <div className="col-12">
                        <div className="table-form">
                            <div className="table-form-row table-form-row-dense">
                                <div className="table-form-col table-form-col-label">{i18n._('key_ui/widgets/Control/KeypadOverlay_0.1x Move')}</div>
                                <div className="table-form-col">
                                    <kbd style={styles.kbd}>{i18n._('key_ui/widgets/Control/KeypadOverlay_Alt')}</kbd>
                                </div>
                            </div>
                            <div className="table-form-row table-form-row-dense">
                                <div className="table-form-col table-form-col-label">{i18n._('key_ui/widgets/Control/KeypadOverlay_10x Move')}</div>
                                <div className="table-form-col">
                                    <kbd style={styles.kbd}>{i18n._('key_ui/widgets/Control/KeypadOverlay_⇧ Shift')}</kbd>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Tooltip>
    );
};

export default (props) => {
    const { show, children } = { ...props };

    if (!show) {
        return children;
    }

    return (
        <OverlayTrigger
            overlay={keypadTooltip()}
            placement="bottom"
            delayShow={300}
        >
            {children}
        </OverlayTrigger>
    );
};
