import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import ObjectList from './ObjectList';
import ToolPathList from './ToolPathList';
import { PAGE_EDITOR, PAGE_PROCESS } from '../../../constants';

class CncLaserList extends PureComponent {
    static propTypes = {
        page: PropTypes.string.isRequired
    };

    render() {
        const { page } = this.props;

        return (
            <div>
                <div>
                    {page === PAGE_EDITOR && <ObjectList {...this.props} />}
                </div>
                <div>
                    {page === PAGE_PROCESS && <ToolPathList {...this.props} />}
                </div>
            </div>
        );
    }
}

// eslint-disable-next-line no-unused-vars
const mapStateToProps = (state, ownProps) => {
    const { page } = state[ownProps.headType];

    return {
        page
    };
};

// eslint-disable-next-line no-unused-vars
const mapDispatchToProps = (dispatch, ownProps) => {
    return {
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(CncLaserList);
