import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import _ from 'lodash';
import Anchor from '../components/Anchor';
import styles from './index.styl';
import { library } from './lib/ext-shapes';

class SVGLeftBar extends PureComponent {
    static propTypes = {
        mode: PropTypes.string.isRequired,
        setMode: PropTypes.func.isRequired,
        insertDefaultTextVector: PropTypes.func.isRequired,
        onChangeFile: PropTypes.func.isRequired,
        onClickToUpload: PropTypes.func.isRequired,
        fileInput: PropTypes.object.isRequired,
        allowedFiles: PropTypes.string.isRequired,
        editable: PropTypes.bool.isRequired
    };

    state = {
        showExtShape: false
        // extShape: null
    };

    actions = {
        onClickInsertText: () => {
            this.props.insertDefaultTextVector();
        },

        setMode: (mode, ext) => {
            this.setState({
                showExtShape: false
                // extShape: ext
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
        const { mode, editable } = this.props;
        const { showExtShape, extShape } = this.state;
        return (
            <React.Fragment>
                <div className={classNames(styles['svg-left-bar'])}>
                    <div className={classNames('position-ab', 'height-100', 'border-radius-8', styles['center-tool'])}>
                        <input
                            ref={this.props.fileInput}
                            type="file"
                            accept={this.props.allowedFiles}
                            className="display-none"
                            multiple={false}
                            onChange={this.props.onChangeFile}
                            disabled={!editable}
                        />
                        <Anchor
                            componentClass="button"
                            className={
                                classNames('width-56', 'height-56', 'border-radius-top-8', 'background-transparent', 'border-0', 'padding-0', 'position-re',
                                    { [styles.selected]: (mode === 'add') })}
                            onClick={() => this.props.onClickToUpload()}
                            disabled={!editable}
                        >
                            <div className={classNames('height-56', styles['btn-add'],)} />
                        </Anchor>
                        <Anchor
                            componentClass="button"
                            className={classNames('width-56', 'height-56', 'background-transparent', 'border-0', 'padding-0', 'position-re',
                                { [styles.selected]: (mode === 'select') })}
                            onClick={() => this.actions.setMode('select')}
                            disabled={!editable}
                        >
                            <div className={classNames('height-56', styles['btn-select'])} />
                        </Anchor>

                        <Anchor
                            componentClass="button"
                            className={classNames('width-56', 'height-56', 'background-transparent', 'border-0', 'padding-0', 'position-re',
                                { [styles.selected]: mode === 'rect' })}
                            onClick={() => this.actions.setMode('rect')}
                            disabled={!editable}
                        >
                            <div className={classNames('height-56', styles['btn-rectangle'])} />
                        </Anchor>

                        <Anchor
                            componentClass="button"
                            className={classNames('width-56', 'height-56', 'background-transparent', 'border-0', 'padding-0', 'position-re',
                                { [styles.selected]: mode === 'ellipse' })}
                            onClick={() => this.actions.setMode('ellipse')}
                            disabled={!editable}
                        >
                            <div className={classNames('height-56', styles['btn-round'])} />
                        </Anchor>
                        <Anchor
                            componentClass="button"
                            className={classNames('width-56', 'height-56', 'background-transparent', 'border-0', 'padding-0', 'position-re')}
                            onClick={this.actions.onClickInsertText}
                            disabled={!editable}
                        >
                            <div className={classNames('height-56', styles['btn-text'])} />
                        </Anchor>
                        {/* todo: refactor style*/}
                        { showExtShape && (
                            <Anchor
                                componentClass="button"
                                className={classNames(styles['btn-center'],
                                    { [styles.selected]: mode === 'ext' })}
                                onClick={() => this.actions.showExt()}
                                disabled={!editable}
                            >
                                <i className={styles[mode === 'ext' && extShape ? `btn-${extShape}` : 'btn-ext']} />
                            </Anchor>
                        )}
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
                                        disabled={!editable}
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

export default SVGLeftBar;
