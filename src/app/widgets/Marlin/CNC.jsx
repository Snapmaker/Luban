import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { actions as machineActions } from '../../flux/machine';
import WorkSpeed from './WorkSpeed';
import i18n from '../../lib/i18n';


class Printing extends PureComponent {
    static propTypes = {
        headStatus: PropTypes.bool,

        executePrintingGcode: PropTypes.func.isRequired
    };

    state = {
        headStatus: this.props.headStatus
    };

    actions = {
        onClickToolHead: () => {
            if (this.state.headStatus) {
                this.props.executePrintingGcode('M5');
            } else {
                this.props.executePrintingGcode('M3');
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
                <div className="sm-parameter-container">
                    <WorkSpeed />
                    <div className="sm-parameter-row">
                        <span className="sm-parameter-row__label-lg">{i18n._('Laser Power')}</span>
                        <button
                            type="button"
                            className={!headStatus ? 'sm-btn-small sm-btn-primary' : 'sm-btn-small sm-btn-danger'}
                            style={{
                                float: 'right'
                            }}
                            onClick={this.actions.onClickToolHead}
                        >
                            {headStatus && <i className="fa fa-toggle-off" />}
                            {!headStatus && <i className="fa fa-toggle-on" />}
                            <span className="space" />
                            {!headStatus ? i18n._('Open') : i18n._('Close')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}


const mapDispatchToProps = (dispatch) => {
    return {
        executePrintingGcode: (gcode) => dispatch(machineActions.executePrintingGcode(gcode))
    };
};

export default connect(null, mapDispatchToProps)(Printing);
