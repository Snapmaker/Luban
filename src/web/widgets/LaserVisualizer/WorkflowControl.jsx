import classNames from 'classnames';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import connect from 'react-redux/es/connect/connect';
import i18n from '../../lib/i18n';
import styles from '../LaserParams/styles.styl';
import { actions } from '../../reducers/modules/laser';
import modal from '../../lib/modal';


class WorkflowControl extends PureComponent {
    static propTypes = {
        isAllModelsPreviewed: PropTypes.bool.isRequired,
        model: PropTypes.object,
        previewSelectedModel: PropTypes.func.isRequired,
        generateGcode: PropTypes.func.isRequired,
        removeSelectedModel: PropTypes.func.isRequired,
        updateIsAllModelsPreviewed: PropTypes.func.isRequired
    };

    actions = {
        deleteSelected: () => {
            this.props.removeSelectedModel();
        },
        generateGcode: () => {
            if (!this.props.updateIsAllModelsPreviewed()) {
                modal({
                    title: i18n._('Warning'),
                    body: i18n._('Please preview all images')
                });
                return;
            }
            this.props.generateGcode();
        }
    };

    render() {
        const { model } = this.props;
        const isAnyModelSelected = !!model;
        const actions = this.actions;

        return (
            <div style={{ marginBottom: '15px' }}>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-default'])}
                    onClick={actions.deleteSelected}
                    disabled={!isAnyModelSelected}
                    style={{ display: 'block', width: '100%', marginTop: '5px' }}
                >
                    {i18n._('Delete Selected Model')}
                </button>
                <button
                    type="button"
                    className={classNames(styles['btn-large'], styles['btn-default'])}
                    onClick={actions.generateGcode}
                    style={{ display: 'block', width: '100%', marginTop: '5px' }}
                >
                    {i18n._('Generate G-Code')}
                </button>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const laser = state.laser;
    return {
        isAllModelsPreviewed: laser.isAllModelsPreviewed,
        canPreview: laser.canPreview,
        model: laser.model
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateIsAllModelsPreviewed: () => dispatch(actions.updateIsAllModelsPreviewed()),
        previewSelectedModel: () => dispatch(actions.previewSelectedModel()),
        generateGcode: () => dispatch(actions.generateGcode()),
        removeSelectedModel: () => dispatch(actions.removeSelectedModel())
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(WorkflowControl);

