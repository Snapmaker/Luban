import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';
import Anchor from '../../components/Anchor';
import { actions as editorActions } from '../../flux/editor';
import { PAGE_EDITOR } from '../../constants';
import { NumberInput as Input } from '../../components/Input';

class JobType extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,
        setDisplay: PropTypes.func.isRequired,

        page: PropTypes.string.isRequired,

        size: PropTypes.object.isRequired,

        materials: PropTypes.object.isRequired,

        updateMaterials: PropTypes.func.isRequired
    };

    state = {
    };

    actions = {
    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Job Type'));
    }

    componentWillReceiveProps(nextProps) {
        this.props.setDisplay(nextProps.page === PAGE_EDITOR);
    }

    render() {
        const { size, materials } = this.props;
        const { isRotate, diameter, length } = materials;

        return (
            <React.Fragment>
                <div className="container-fluid">
                    <div className="row">
                        <Anchor className="col-6" onClick={() => { this.props.updateMaterials({ isRotate: false }); }}>
                            <div>
                                <i
                                    style={{
                                        marginRight: '8px'
                                    }}
                                    className={isRotate ? 'fa fa-circle-o' : 'fa fa-dot-circle-o'}
                                    aria-hidden="true"
                                />
                                <span>3 Axis CNC</span>
                            </div>
                            <img
                                style={{
                                    margin: '8px 0px 0px 0px'
                                }}
                                width="130px"
                                src="images/cnc/cnc-3th-2x.png"
                                role="presentation"
                                alt="3 Axis CNC"
                            />
                        </Anchor>
                        <Anchor className="col-6" onClick={() => { this.props.updateMaterials({ isRotate: true }); }}>
                            <div>
                                <i
                                    style={{
                                        marginRight: '8px'
                                    }}
                                    className={isRotate ? 'fa fa-dot-circle-o' : 'fa fa-circle-o'}
                                    aria-hidden="true"
                                />
                                <span>4 Axis CNC</span>
                            </div>
                            <img
                                style={{
                                    margin: '8px 0px 0px 0px'
                                }}
                                width="130px"
                                src="images/cnc/cnc-4th-2x.png"
                                role="presentation"
                                alt="4 Axis CNC"
                            />
                        </Anchor>
                    </div>
                </div>
                {isRotate && (
                    <div style={{
                        marginTop: '16px',
                        padding: '0px 15px 0px 15px'
                    }}
                    >
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Diameter')}</span>
                            <Input
                                disabled={false}
                                className="sm-parameter-row__input"
                                value={diameter}
                                max={size.x}
                                min={0.1}
                                onChange={(value) => { this.props.updateMaterials({ diameter: value }); }}
                            />
                            <span className="sm-parameter-row__input-unit">mm</span>
                        </div>
                        <div className="sm-parameter-row">
                            <span className="sm-parameter-row__label">{i18n._('Length')}</span>
                            <Input
                                disabled={false}
                                className="sm-parameter-row__input"
                                value={length}
                                max={size.y}
                                min={0.1}
                                onChange={(value) => { this.props.updateMaterials({ length: value }); }}
                            />
                            <span className="sm-parameter-row__input-unit">mm</span>
                        </div>
                    </div>

                )}
            </React.Fragment>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const { headType } = ownProps;
    const { size } = state.machine;
    const { page, materials } = state[headType];

    return {
        size,
        page,
        materials
    };
};

const mapDispatchToProps = (dispatch, ownProps) => {
    const { headType } = ownProps;

    return {
        updateMaterials: (materials) => dispatch(editorActions.updateMaterials(headType, materials))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(JobType);
