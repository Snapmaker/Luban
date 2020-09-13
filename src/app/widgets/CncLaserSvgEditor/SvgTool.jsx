import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import _ from 'lodash';
import Anchor from '../../components/Anchor';
import styles from './index.styl';
import { library } from './lib/ext-shapes';

class SvgTool extends PureComponent {
    static propTypes = {
        mode: PropTypes.string.isRequired,
        setMode: PropTypes.func.isRequired,
        insertDefaultTextVector: PropTypes.func.isRequired
    };

    state = {
        showExtShape: false,
        extShape: null
    }

    actions = {
        onClickInsertText: () => {
            this.props.insertDefaultTextVector();
        },

        setMode: (mode, ext) => {
            this.setState({
                showExtShape: false,
                extShape: ext
            });
            this.props.setMode(mode, ext);
        },

        showExt: () => {
            this.setState({
                showExtShape: !this.state.showExtShape
            });
        }
    };

    render() {
        const { mode } = this.props;
        const { showExtShape, extShape } = this.state;
        return (
            <React.Fragment>
                <div className={classNames(styles['visualizer-center'])}>
                    <div className={styles['center-tool']}>
                        <Anchor
                            componentClass="button"
                            className={classNames(styles['btn-center'],
                                { [styles.selected]: (mode === 'select') })}
                            onClick={() => this.actions.setMode('select')}
                        >
                            <i className={styles['btn-select']} />
                        </Anchor>
                        <Anchor
                            componentClass="button"
                            className={classNames(styles['btn-center'],
                                { [styles.selected]: mode === 'rect' })}
                            onClick={() => this.actions.setMode('rect')}
                        >
                            <i className={styles['btn-rectangle']} />
                        </Anchor>
                        <Anchor
                            componentClass="button"
                            className={classNames(styles['btn-center'],
                                { [styles.selected]: mode === 'ellipse' })}
                            onClick={() => this.actions.setMode('ellipse')}
                        >
                            <i className={classNames(styles['btn-round'])} />
                        </Anchor>
                        <Anchor
                            componentClass="button"
                            className={styles['btn-center']}
                            onClick={this.actions.onClickInsertText}
                        >
                            <i className={styles['btn-text']} />
                        </Anchor>
                        <Anchor
                            componentClass="button"
                            className={classNames(styles['btn-center'],
                                { [styles.selected]: mode === 'ext' })}
                            onClick={() => this.actions.showExt()}
                        >
                            <i className={styles[mode === 'ext' && extShape ? `btn-${extShape}` : 'btn-ext']} />
                        </Anchor>
                    </div>
                    {showExtShape && (
                        <div className={classNames(styles['center-ext'])}>
                            {_.map(library.use, (key) => {
                                return (
                                    <Anchor
                                        key={key}
                                        componentClass="button"
                                        className={styles['btn-center-ext']}
                                        onClick={() => this.actions.setMode('ext', key)}
                                    >
                                        <i className={styles[`btn-ext-${key}`]} />
                                    </Anchor>
                                );
                            })}
                        </div>
                    )}
                </div>

            </React.Fragment>
        );
    }
}

// const mapStateToProps = (state) => {
//     return {
//
//     };
// };
//
// const mapDispatchToProps = (dispatch) => ({
//     insertDefaultTextVector: () => dispatch(editorActions.insertDefaultTextVector('laser'))
// });


export default SvgTool;
