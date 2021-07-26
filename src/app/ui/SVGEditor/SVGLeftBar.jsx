import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import _ from 'lodash';
import Anchor from '../components/Anchor';
import SvgIcon from '../components/SvgIcon';
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
                    <div className={classNames('position-ab', 'height-percent-100', 'border-radius-8', styles['center-tool'])}>
                        <input
                            ref={this.props.fileInput}
                            type="file"
                            accept={this.props.allowedFiles}
                            className="display-none"
                            multiple={false}
                            onChange={this.props.onChangeFile}
                            disabled={!editable}
                        />
                        <div className={classNames('border-bottom-normal',)}>
                            <div className="margin-vertical-4">

                                <SvgIcon
                                    type={['hoverNormal', 'pressSpecial']}
                                    size={48}
                                    name="ToolbarOpen"
                                    disabled={!editable}
                                    color="#545659"
                                    className={
                                        classNames('border-radius-top-8', 'background-transparent',
                                            'padding-horizontal-4', 'position-re',
                                            { [styles.selected]: (mode === 'add') })}
                                    onClick={() => this.props.onClickToUpload()}
                                />
                            </div>
                        </div>
                        <div className="margin-vertical-4">
                            <SvgIcon
                                color="#545659"
                                type={['hoverNormal', 'pressSpecial']}
                                size={48}
                                name="ToolbarSelect"
                                disabled={!editable}
                                className={
                                    classNames('background-transparent',
                                        'padding-horizontal-4', 'position-re',
                                        { [styles.selected]: (mode === 'select') })}
                                onClick={() => this.props.setMode('select')}
                            />
                        </div>
                        <div className="margin-vertical-4">
                            <SvgIcon
                                type={['hoverNormal', 'pressSpecial']}
                                color="#545659"
                                size={48}
                                name="ToolbarRectangle"
                                disabled={!editable}
                                className={
                                    classNames('background-transparent',
                                        'padding-horizontal-4', 'position-re',
                                        { [styles.selected]: (mode === 'rect') })}
                                onClick={() => this.props.setMode('rect')}
                            />
                        </div>
                        <div className="margin-vertical-4">
                            <SvgIcon
                                type={['hoverNormal', 'pressSpecial']}
                                color="#545659"
                                size={48}
                                name="ToolbarOval"
                                disabled={!editable}
                                className={
                                    classNames('background-transparent',
                                        'padding-horizontal-4', 'position-re',
                                        { [styles.selected]: (mode === 'ellipse') })}
                                onClick={() => this.props.setMode('ellipse')}
                            />
                        </div>
                        <div className="margin-vertical-4">
                            <SvgIcon
                                type={['hoverNormal', 'pressSpecial']}
                                color="#545659"
                                size={48}
                                name="ToolbarText"
                                disabled={!editable}
                                className={
                                    classNames('background-transparent',
                                        'padding-horizontal-4', 'position-re',)}
                                onClick={this.actions.onClickInsertText}
                            />
                        </div>
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
