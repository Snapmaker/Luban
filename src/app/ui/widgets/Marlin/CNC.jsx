import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { actions as machineActions } from '../../../flux/machine';
import WorkSpeed from './WorkSpeed';
import i18n from '../../../lib/i18n';
import Switch from '../../components/Switch';


class Printing extends PureComponent {
    static propTypes = {
        headStatus: PropTypes.bool,

        executeGcode: PropTypes.func.isRequired
    };

    state = {
        headStatus: this.props.headStatus
    };

    actions = {
        onClickToolHead: () => {
            if (this.state.headStatus) {
                this.props.executeGcode('M5');
            } else {
                this.props.executeGcode('M3 P100');
            }
            this.setState({
                headStatus: !this.state.headStatus
            });
        }
    };

    render() {
        const { headStatus } = this.state;
        return (
            <div>
                <WorkSpeed />
                <div className="sm-flex justify-space-between margin-vertical-8">
                    <span>{i18n._('Tool Head')}</span>
                    <Switch
                        className="sm-flex-auto"
                        onClick={this.actions.onClickToolHead}
                        checked={headStatus}
                    />
                </div>
            </div>
        );
    }
}


const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode) => dispatch(machineActions.executeGcode(gcode))
    };
};

export default connect(null, mapDispatchToProps)(Printing);
