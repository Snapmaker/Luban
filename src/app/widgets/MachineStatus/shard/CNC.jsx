import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import Anchor from '../../../components/Anchor';
import i18n from '../../../lib/i18n';
import { NumberInput as Input } from '../../../components/Input';
import { actions as machineActions } from '../../../flux/machine';


class Printing extends PureComponent {
    static propTypes = {
        printingExpanded: PropTypes.bool,

        executePrintingGcode: PropTypes.func.isRequired,
        updateWidgetState: PropTypes.func
    };


    state = {
        workSpeed: 100,
        workSpeedValue: 100
    };

    actions = {
        togglePrinting: () => {
            this.props.updateWidgetState({
                printingExpanded: !this.props.printingExpanded
            });
        },
        onChangeWorkSpeedValue: (value) => {
            this.setState({
                workSpeedValue: value
            });
        },
        onClickWorkSpeed: () => {
            const workSpeedValue = this.state.workSpeedValue;
            this.setState({
                workSpeed: workSpeedValue
            });
            this.props.executePrintingGcode(`M221 S${workSpeedValue}`);
        }
    };

    render() {
        const { printingExpanded } = this.props;
        const { workSpeed, workSpeedValue } = this.state;
        const actions = this.actions;
        return (
            <div>
                <div className="sm-parameter-container">
                    <Anchor className="sm-parameter-header" onClick={actions.togglePrinting}>
                        <span className="fa fa-gear sm-parameter-header__indicator" />
                        <span className="sm-parameter-header__title">{i18n._('CNC')}</span>
                        <span className={classNames(
                            'fa',
                            printingExpanded ? 'fa-angle-double-up' : 'fa-angle-double-down',
                            'sm-parameter-header__indicator',
                            'pull-right',
                        )}
                        />
                    </Anchor>
                    <div className="sm-parameter-row">
                        <span className="sm-parameter-row__label-lg">{i18n._('Work Speed')}</span>
                        <span className="sm-parameter-row__input2-text">{workSpeed}/</span>
                        <Input
                            className="sm-parameter-row__input2"
                            value={workSpeedValue}
                            max={500}
                            min={0}
                            onChange={actions.onChangeWorkSpeedValue}
                        />
                        <span className="sm-parameter-row__input2-unit">%</span>
                        <Anchor
                            className="sm-parameter-row__input2-check fa fa-chevron-circle-right"
                            onClick={actions.onClickWorkSpeed}
                        />
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
