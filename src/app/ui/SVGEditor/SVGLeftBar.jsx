import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import _ from 'lodash';
import SvgIcon from '../components/SvgIcon';
import styles from './index.styl';
import { library } from './lib/ext-shapes';
import i18n from '../../lib/i18n';

class SVGLeftBar extends PureComponent {
    static propTypes = {
        mode: PropTypes.string.isRequired,
        setMode: PropTypes.func.isRequired,
        insertDefaultTextVector: PropTypes.func.isRequired,
        onChangeFile: PropTypes.func.isRequired,
        onClickToUpload: PropTypes.func.isRequired,
        fileInput: PropTypes.object.isRequired,
        allowedFiles: PropTypes.string.isRequired,
        editable: PropTypes.bool,
        headType: PropTypes.string
    };

    state = {
        showExtShape: false,
        extShape: null
    };

    actions = {
        onClickInsertText: () => {
            this.props.insertDefaultTextVector();
        },

        setMode: (mode, ext) => {
            this.setState({
                showExtShape: false,
                extShape: ext ?? this.state.extShape
            });
            this.props.setMode(mode, ext);
        },

        showExt: () => {
            const selectedShape = this.state.extShape ?? library.use[0];
            this.setState({
                showExtShape: true,
                extShape: selectedShape
            });
            this.props.setMode('ext', selectedShape);
        },

        hideLeftBarOverlay: () => {
            this.setState({
                showExtShape: false
            });
        }
    };

    render() {
        const { mode, editable } = this.props;
        const { showExtShape, extShape } = this.state;
        return (
            <React.Fragment>
                <div className={classNames(styles['svg-left-bar'])}>
                    <div className={classNames('position-ab', 'height-percent-100', 'border-radius-8', styles['center-tool'], 'box-shadow-module')}>
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
                                            'padding-horizontal-4', 'position-re', `${this.props.headType}-tool-bar-open-icon`,
                                            { [styles.selected]: (mode === 'add') })
                                    }
                                    onClick={() => this.props.onClickToUpload()}
                                />
                            </div>
                        </div>
                        <div className={`${this.props.headType}-draw-intro-part`}>
                            <div className="margin-vertical-4">
                                <SvgIcon
                                    color="#545659"
                                    type={[`${mode === 'select' ? 'hoverNoBackground' : 'hoverNormal'}`, 'pressSpecial']}
                                    size={48}
                                    name="ToolbarSelect"
                                    disabled={!editable}
                                    className={
                                        classNames('background-transparent',
                                            'padding-horizontal-4', 'position-re',
                                            { [styles.selected]: (mode === 'select') })
                                    }
                                    onClick={() => this.actions.setMode('select')}
                                />
                            </div>
                            <div className="margin-vertical-4">
                                <SvgIcon
                                    type={[`${mode === 'rect' ? 'hoverNoBackground' : 'hoverNormal'}`, 'pressSpecial']}
                                    color="#545659"
                                    size={48}
                                    name="ToolbarRectangle"
                                    disabled={!editable}
                                    className={
                                        classNames('background-transparent',
                                            'padding-horizontal-4', 'position-re',
                                            { [styles.selected]: (mode === 'rect') })
                                    }
                                    onClick={() => this.actions.setMode('rect')}
                                />
                            </div>
                            <div className="margin-vertical-4">
                                <SvgIcon
                                    type={[`${mode === 'ellipse' ? 'hoverNoBackground' : 'hoverNormal'}`, 'pressSpecial']}
                                    color="#545659"
                                    size={48}
                                    name="ToolbarOval"
                                    disabled={!editable}
                                    className={
                                        classNames('background-transparent',
                                            'padding-horizontal-4', 'position-re',
                                            { [styles.selected]: (mode === 'ellipse') })
                                    }
                                    onClick={() => this.actions.setMode('ellipse')}
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
                                            'padding-horizontal-4', 'position-re',)
                                    }
                                    onClick={this.actions.onClickInsertText}
                                />
                            </div>
                            <div className="margin-vertical-4">
                                <SvgIcon
                                    type={[`${mode === 'ext' ? 'hoverNoBackground' : 'hoverNormal'}`, 'pressSpecial']}
                                    color="#545659"
                                    size={48}
                                    name="ToolbarOtherGraphics"
                                    disabled={!editable}
                                    className={
                                        classNames('background-transparent',
                                            'padding-horizontal-4', 'position-re',
                                            { [styles.selected]: mode === 'ext' })
                                    }
                                    onClick={this.actions.showExt}
                                />
                            </div>
                        </div>
                    </div>
                    {showExtShape && mode === 'ext' && (
                        <div
                            className="position-ab width-272 margin-left-72 margin-top-268 border-default-grey-1 border-radius-8 background-color-white"
                        >
                            <div className="border-bottom-normal padding-vertical-10 padding-horizontal-16 height-40">
                                {i18n._('key-Laser/LeftBar-Insert Draw')}
                            </div>
                            <div>
                                <div className="sm-flex">
                                    <div
                                        className={classNames(styles['center-ext'])}
                                    >
                                        {_.map(library.use, (key) => {
                                            return (
                                                <SvgIcon
                                                    key={key}
                                                    type={['hoverNormal', 'pressSpecial']}
                                                    color="#545659"
                                                    size={48}
                                                    name={`Toolbar${key.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join('')}`}
                                                    disabled={!editable}
                                                    className={
                                                        classNames('background-transparent',
                                                            'padding-horizontal-4', 'position-re',
                                                            styles['btn-center-ext'],
                                                            { [styles.selected]: extShape === key })
                                                    }
                                                    onClick={() => this.actions.setMode('ext', key)}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            </React.Fragment>
        );
    }
}

export default SVGLeftBar;
