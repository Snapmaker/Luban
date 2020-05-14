import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import classNames from 'classnames';
import styles from './styles.styl';
import { PAGE_EDITOR, PAGE_PROCESS } from '../../constants';
import { actions as cncLaserActions } from '../../flux/editor';
import i18n from '../../lib/i18n';


class PageControl extends Component {
    static propTypes = {
        ...withRouter.propTypes,
        page: PropTypes.string,
        from: PropTypes.string,

        togglePage: PropTypes.func.isRequired
    };

    actions= {

    };

    render() {
        const { page, from } = this.props;
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
                        onClick={() => {
                            this.props.togglePage(from, PAGE_EDITOR);
                        }}
                    >{i18n._('Editor')}
                    </button>
                    <button
                        type="button"
                        className={classNames('btn', { [styles.selected]: isProcess })}
                        onClick={() => {
                            this.props.togglePage(from, PAGE_PROCESS);
                        }}
                    >{i18n._('Process')}
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
        togglePage: (from, page) => dispatch(cncLaserActions.togglePage(from, page))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(PageControl);
