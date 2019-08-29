import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

// import { NumberInput } from '../../components/Input';
import { actions as machineActions } from '../../flux/machine';
import styles from './index.styl';


class DeveloperPanel extends PureComponent {
    static propTypes = {
        // redux
        port: PropTypes.string.isRequired,
        server: PropTypes.object.isRequired,
        executeGcode: PropTypes.func.isRequired
    };

    /*
    state = {
    };
    */

    actions = {
        jog: () => {
            const data = 'G1 X5';
            const { port, server } = this.props;
            console.log('ps', port, server, data);
            this.props.executeGcode(data);
        }
    };

    /*
    constructor(props) {
        super(props);
    }
    */

    componentDidMount() {
    }

    setMode() {
        // this.mode = mode;
    }

    render() {
        console.log('render');
        return (
            <div className={styles['laser-table']}>
                <div className={styles['laser-table-row']}>
                    <div className={styles['svg-control-bar']}>
                        <p>Developer Panel</p>
                        <button type="button" onClick={() => this.actions.jog()}>JogX</button>
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const machine = state.machine;

    const { port, server } = machine;

    return {
        port,
        server
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        executeGcode: (gcode) => dispatch(machineActions.executeGcode(gcode))
    };
};


export default connect(mapStateToProps, mapDispatchToProps)(DeveloperPanel);

// export default DeveloperPanel;
