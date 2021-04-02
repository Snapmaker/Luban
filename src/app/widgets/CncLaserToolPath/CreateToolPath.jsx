import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { PAGE_PROCESS } from '../../constants';
import { actions as editorActions } from '../../flux/editor';

import i18n from '../../lib/i18n';

class CreateToolPath extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,
        setDisplay: PropTypes.func.isRequired,
        page: PropTypes.string.isRequired,
        toolPathTypes: PropTypes.array.isRequired,

        createToolPath: PropTypes.func.isRequired
    };

    thumbnail = React.createRef();

    actions = {
    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Create Toolpath'));
        this.props.setDisplay(this.props.page === PAGE_PROCESS);
    }

    componentWillReceiveProps(nextProps) {
        this.props.setDisplay(nextProps.page === PAGE_PROCESS);
    }

    render() {
        return (
            <div>
                <div>
                    {this.props.toolPathTypes.length === 0 && (
                        <div style={{ height: '20px', textAlign: 'center' }}>
                            <img
                                src="../../images/cnc-laser/ic_warning_20x20.png"
                                style={{
                                    marginTop: '-4px',
                                    width: '20px',
                                    height: '20px'
                                }}
                                alt="......"
                            />
                            <div style={{
                                display: 'inline-block',
                                color: '#979899',
                                fontSize: '14px',
                                fontFamily: 'Roboto-Regular, Roboto',
                                height: '19px',
                                lineHeight: '19px',
                                marginLeft: '9px'
                            }}
                            >
                                {i18n._('Select Object to Create Toolpath')}
                            </div>
                        </div>
                    )}
                    { this.props.toolPathTypes.length === 1 && (
                        <button
                            type="button"
                            className="sm-btn-large sm-btn-default"
                            onClick={this.props.createToolPath}
                            style={{ display: 'block', width: '100%' }}
                        >
                            {i18n._('Create Toolpath')}
                        </button>
                    )}
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state, ownProps) => {
    const { page, toolPathGroup } = state[ownProps.headType];
    const toolPathTypes = toolPathGroup.getToolPathTypes();

    return {
        page,
        toolPathTypes
    };
};

const mapDispatchToProps = (dispatch, ownProps) => {
    return {
        createToolPath: () => dispatch(editorActions.createToolPath(ownProps.headType))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(CreateToolPath);
