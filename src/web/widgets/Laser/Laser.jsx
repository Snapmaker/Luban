import Slider from 'rc-slider';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import shallowCompare from 'react-addons-shallow-compare';
import Panel from '../../components/Panel';
import Toggler from '../../components/Toggler';
import i18n from '../../lib/i18n';
import styles from './index.styl';

class Laser extends Component {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };

    shouldComponentUpdate(nextProps, nextState) {
        return shallowCompare(this, nextProps, nextState);
    }
    render() {
        const { state, actions } = this.props;
        const { canClick, panel, test } = state;

        return (
            <div>
                <div className="form-group">
                    <label className="control-label">
                        Laser Control
                    </label>
                    <div className="row no-gutters">
                        <div className="col-xs-4">
                            <div className="btn-group" role="group">
                                <button
                                    type="button"
                                    className="btn btn-default"
                                    style={{ minWidth: 80 }}
                                    disabled={!canClick}
                                    onClick={actions.laserOn}
                                >
                                    Laser On
                                </button>
                            </div>
                        </div>

                        <div className="col-xs-4">
                            <div className="btn-group" role="group">
                                <button
                                    type="button"
                                    className="btn btn-default"
                                    style={{ minWidth: 80 }}
                                    disabled={!canClick}
                                    onClick={actions.laserTestOff}
                                >
                                    {i18n._('Laser Off')}
                                </button>
                            </div>
                        </div>

                        <div className="col-xs-4">
                            <div className="btn-group" role="group">
                                <button
                                    type="button"
                                    className="btn btn-default"
                                    style={{ minWidth: 80 }}
                                    disabled={!canClick}
                                    onClick={actions.laserSave}
                                >
                                    Save(SD Card)
                                </button>
                            </div>
                        </div>

                    </div>
                </div>

                <Panel className={styles.panel}>
                    <Panel.Heading className={styles.panelHeading}>
                        <Toggler
                            className="clearfix"
                            onToggle={actions.toggleLaserTest}
                            title={panel.laserTest.expanded ? i18n._('Hide') : i18n._('Show')}
                        >
                            <div className="pull-left">{i18n._('Laser Test')}</div>
                            <Toggler.Icon
                                className="pull-right"
                                expanded={panel.laserTest.expanded}
                            />
                        </Toggler>
                    </Panel.Heading>
                    {panel.laserTest.expanded &&
                    <Panel.Body>

                        <div className="table-form" style={{ marginBottom: 15 }}>
                            <div className="table-form-row">
                                <div className="table-form-col table-form-col-label middle">
                                    {i18n._('Power (%)')}
                                </div>
                                <div className="table-form-col">
                                    <div className="text-center">{test.power}%</div>
                                    <Slider
                                        style={{ padding: 0 }}
                                        defaultValue={test.power}
                                        min={0}
                                        max={100}
                                        step={1}
                                        onChange={actions.changeLaserTestPower}
                                    />
                                </div>
                            </div>
                            <div className="table-form-row">
                                <div className="table-form-col table-form-col-label middle">
                                    {i18n._('Test duration')}
                                </div>
                                <div className="table-form-col">
                                    <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                        <input
                                            type="number"
                                            className="form-control"
                                            style={{ borderRadius: 0 }}
                                            value={test.duration}
                                            min={0}
                                            step={1}
                                            onChange={actions.changeLaserTestDuration}
                                        />
                                        <span className="input-group-addon">{i18n._('ms')}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="table-form-row">
                                <div className="table-form-col table-form-col-label middle">
                                    {i18n._('Maximum value')}
                                </div>
                                <div className="table-form-col">
                                    <div className="input-group input-group-sm" style={{ width: '100%' }}>
                                        <span className="input-group-addon">S</span>
                                        <input
                                            type="number"
                                            className="form-control"
                                            style={{ borderRadius: 0 }}
                                            value={test.maxS}
                                            min={0}
                                            step={1}
                                            onChange={actions.changeLaserTestMaxS}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="btn-toolbar" role="toolbar">
                            <div className="btn-group" role="group">
                                <button
                                    type="button"
                                    className="btn btn-default"
                                    style={{ minWidth: 80 }}
                                    disabled={!canClick}
                                    onClick={actions.laserTestOn}
                                >
                                    {i18n._('Laser Test')}
                                </button>
                            </div>
                        </div>

                    </Panel.Body>
                    }
                </Panel>
            </div>
        );
    }
}

export default Laser;
