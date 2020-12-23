// import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import styles from './index.styl';
import { Button } from '../../components/Buttons';
import {
    FILTER_SPEED_FAST,
    FILTER_SPEED_MEDIUM,
    FILTER_SPEED_LOW
} from '../../constants';


class Filter extends PureComponent {
    static propTypes = {
        // redux
    };

    state = {
        isFilterEnable: true,
        workSpeed: FILTER_SPEED_FAST,
        filterLife: 2
    };

    actions = {
        onHandleFilterEnabled: () => {
            this.setState({
                isFilterEnable: !this.state.isFilterEnable
            });
        },
        onChangeFilterSpeed: (workSpeed) => {
            console.log('workspeed', workSpeed);
            this.setState({
                workSpeed: workSpeed
            });
        }
    };


    render() {
        const { isFilterEnable, workSpeed, filterLife } = this.state;
        return (
            <div>
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <tbody>
                            <tr key="1">
                                <td>
                                    Filter
                                </td>
                                <td>
                                    <Button onClick={this.actions.onHandleFilterEnabled}>
                                        {isFilterEnable ? 'on' : 'off'}
                                    </Button>
                                </td>
                            </tr>
                        </tbody>
                        <tbody>
                            <tr key="2">
                                <td>
                                    Work Speed
                                </td>
                                <td>
                                    <Button onClick={() => this.actions.onChangeFilterSpeed(FILTER_SPEED_LOW)}>
                                        {workSpeed === FILTER_SPEED_LOW ? 'on' : 'Low'}
                                    </Button>
                                </td>
                                <td>
                                    <Button onClick={() => this.actions.onChangeFilterSpeed(FILTER_SPEED_MEDIUM)}>
                                        {workSpeed === FILTER_SPEED_MEDIUM ? 'on' : 'Medium'}
                                    </Button>
                                </td>
                                <td>
                                    <Button onClick={() => this.actions.onChangeFilterSpeed(FILTER_SPEED_FAST)}>
                                        {workSpeed === FILTER_SPEED_FAST ? 'on' : 'Fast'}
                                    </Button>
                                </td>
                            </tr>
                        </tbody>
                        <tbody>
                            <tr key="3">
                                <td>
                                    Filter Life
                                </td>
                                <td>
                                    {filterLife >= 0 ? '=' : null}
                                    {filterLife >= 1 ? '=' : null}
                                    {filterLife >= 2 ? '=' : null}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { workflowState, workflowStatus, isConnected } = state.machine;

    return {
        isConnected,
        workflowState,
        workflowStatus
    };
};

const mapDispatchToProps = () => {
    return {
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Filter);
