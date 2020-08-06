import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import i18n from '../../lib/i18n';
import { toFixed } from '../../lib/numeric-utils';
import styles from './styles.styl';
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
                <div className="">
                    <div className="sm-tabs" style={{ marginBottom: '1rem' }}>
                        <button
                            type="button"
                            style={{ width: '50%' }}
                            className={classNames('sm-tab', { 'sm-selected': !isRotate })}
                            onClick={() => {
                                this.props.updateMaterials({ isRotate: false });
                            }}
                        >
                            {i18n._('3 Axis')}
                        </button>
                        <button
                            type="button"
                            style={{ width: '50%' }}
                            className={classNames('sm-tab', { 'sm-selected': isRotate })}
                            onClick={() => {
                                this.props.updateMaterials({ isRotate: true });
                            }}
                        >
                            {i18n._('4 Axis')}
                        </button>
                    </div>
                </div>
                {!isRotate && (
                    <img
                        style={{
                            margin: '8px 0px 0px 0px',
                            width: '100%',
                            maxWidth: '326px'
                        }}
                        src="images/cnc-laser/3axis.png"
                        role="presentation"
                        alt="3 Axis"
                    />
                )}
                {isRotate && (
                    <div>
                        <img
                            style={{
                                margin: '8px 0px 0px 0px',
                                width: '100%',
                                maxWidth: '326px'
                            }}
                            src="images/cnc-laser/4axis.png"
                            role="presentation"
                            alt="4 Axis"
                        />
                        <div style={{
                            marginTop: '16px',
                            padding: '0px 15px 0px 15px'
                        }}
                        >
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Diameter (mm)')}</span>
                                <Input
                                    disabled={false}
                                    className={styles['input-box-left']}
                                    value={toFixed(diameter, 2)}
                                    max={size.x}
                                    min={2}
                                    onChange={(value) => { this.props.updateMaterials({ diameter: value }); }}
                                />
                                <span
                                    className={styles['input-box-inner-text']}
                                >
                                    D
                                </span>
                            </div>
                            <div className="sm-parameter-row">
                                <span className="sm-parameter-row__label">{i18n._('Length (mm)')}</span>
                                <Input
                                    disabled={false}
                                    className={styles['input-box-left']}
                                    value={toFixed(length, 2)}
                                    max={size.y}
                                    min={10}
                                    onChange={(value) => { this.props.updateMaterials({ length: value }); }}
                                />
                                <span
                                    className={styles['input-box-inner-text']}
                                >
                                    L
                                </span>
                            </div>
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
