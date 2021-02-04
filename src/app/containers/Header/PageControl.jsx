import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import classNames from 'classnames';
import styles from './styles.styl';
import { PAGE_EDITOR, PAGE_PROCESS } from '../../constants';
import { actions as editorActions } from '../../flux/editor';
import i18n from '../../lib/i18n';


class PageControl extends Component {
    static propTypes = {
        ...withRouter.propTypes,
        page: PropTypes.string,
        from: PropTypes.string,

        switchToPage: PropTypes.func.isRequired
    };

    actions = {
        switchToPageEditor: () => {
            const { from } = this.props;
            this.props.switchToPage(from, PAGE_EDITOR);
        },
        switchToPageProcess: () => {
            const { from } = this.props;
            this.props.switchToPage(from, PAGE_PROCESS);
        }
    };

    render() {
        const { page } = this.props;
        if (page === null) {
            return null;
        }

        const isEditor = page === PAGE_EDITOR;
        const isProcess = page === PAGE_PROCESS;

        return (
            <div className={classNames(styles['editor-and-preview'])}>
                <div className={classNames(styles['btn-position'])}>
                    <button
                        type="button"
                        className={classNames('btn', { [styles.selected]: isEditor })}
                        onClick={this.actions.switchToPageEditor}
                    >
                        {i18n._('Edit')}
                    </button>
                    <button
                        type="button"
                        className={classNames('btn', { [styles.selected]: isProcess })}
                        onClick={this.actions.switchToPageProcess}
                    >
                        {i18n._('Process')}
                    </button>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state, props) => {
    const pathname = props.location.pathname;
    let page = null;
    let from = null;
    if (pathname.indexOf('laser') !== -1) {
        from = 'laser';
        page = state.laser.page;
    } else if (pathname.indexOf('cnc') !== -1) {
        from = 'cnc';
        page = state.cnc.page;
    }
    return {
        page,
        from
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        switchToPage: (from, page) => dispatch(editorActions.switchToPage(from, page))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(PageControl);
