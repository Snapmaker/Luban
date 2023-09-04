import React, { forwardRef, useImperativeHandle, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import _ from 'lodash';

import SvgIcon from '../components/SvgIcon';
import styles from './styles.styl';
import { library } from './lib/ext-shapes';
import i18n from '../../lib/i18n';
import Anchor from '../components/Anchor';
// import { svg } from '../../../server/services/api';

const SVGLeftBar = forwardRef((props, ref) => {
    const [extShape, setExtShape] = useState({
        showExtShape: false,
        shape: null
    });

    const actions = {
        onClickInsertText: async () => {
            if (props.mode === 'draw') {
                await props.onStopDraw(true);
            } else if (props.mode === 'select' && props.selectEditing) {
                await props.onStopDraw(true);
            }
            props.insertDefaultTextVector();
        },

        exitDraw: (mode) => {
            if (props.mode === 'draw') {
                if (mode === 'select') {
                    return props.onStopDraw();
                } else {
                    return props.onStopDraw(true, mode);
                }
            }
            if (props.mode === 'select' && props.selectEditing) {
                return props.onStopDraw(true, mode);
            }
            return Promise.resolve();
        },

        setMode: async (mode, ext) => {
            setExtShape({
                showExtShape: false,
                extShape: ext ?? extShape
            });
            const elem = await actions.exitDraw(mode);
            if (!(mode === 'select' && elem)) {
                props.setMode(mode, ext || {});
            }
        },

        showExt: async () => {
            await actions.exitDraw('ext');

            const selectedShape = extShape ?? library.use[0];
            setExtShape({
                showExtShape: true,
                extShape: selectedShape
            });
            props.setMode('ext', selectedShape);
        },
        createExt: async (ext) => {
            await actions.exitDraw('ext');
            setExtShape({
                showExtShape: false,
                extShape: ext ?? extShape
            });
            props.createExt(ext);
        },

        hideLeftBarOverlay: () => {
            setExtShape({
                ...extShape,
                showExtShape: false
            });
        },
        startDraw: () => {
            props.onStartDraw();
        },
        stopDraw: () => {
            props.onStopDraw(true);
        },

        openSvgShapeLibrary: () => {
            props.updateIsShowSVGShapeLibrary(true);
            actions.setMode('select');
        }
    };

    useImperativeHandle(ref, () => ({
        actions
    }));

    const { mode, editable, selectEditing } = props;
    return (
        <React.Fragment>
            <div className={classNames(styles['svg-left-bar'])}>
                <div className={classNames('position-absolute', 'height-percent-100', 'border-radius-8', styles['center-tool'], 'box-shadow-module')}>
                    <input
                        ref={props.fileInput}
                        type="file"
                        accept={props.allowedFiles}
                        className="display-none"
                        multiple={false}
                        onChange={props.onChangeFile}
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
                                        'padding-horizontal-4', 'position-re', `${props.headType}-tool-bar-open-icon`,
                                        { [styles.selected]: (mode === 'add') })
                                }
                                onClick={() => props.onClickToUpload()}
                            />
                        </div>
                    </div>
                    <div className={`${props.headType}-draw-intro-part`}>
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
                                onClick={() => actions.setMode('select')}
                            />
                        </div>
                        <div className="margin-vertical-4">
                            <SvgIcon
                                color="#545659"
                                type={[`${mode === 'draw' ? 'hoverNoBackground' : 'hoverNormal'}`, 'pressSpecial']}
                                size={48}
                                name="ToolbarPen"
                                // name="ToolbarMirror"
                                disabled={!editable}
                                className={
                                    classNames('background-transparent',
                                        'padding-horizontal-4', 'position-re',
                                        { [styles.selected]: (mode === 'draw') })
                                }
                                onClick={() => actions.startDraw()}
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
                                onClick={() => actions.setMode('rect')}
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
                                onClick={() => actions.setMode('ellipse')}
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
                                        'padding-horizontal-4', 'position-re')
                                }
                                onClick={actions.onClickInsertText}
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
                                onClick={actions.showExt}
                            />
                        </div>
                    </div>
                </div>
                {
                    mode === 'select' && selectEditing && (
                        <div
                            className="position-absolute width-152 margin-left-72 margin-top-64 border-default-grey-1 border-radius-8 background-color-white"
                        >
                            <div className="border-bottom-normal padding-vertical-8 padding-horizontal-16 height-40">
                                {i18n._('key-Laser/LeftBar-Draw Path')}
                            </div>
                            <div className={classNames(styles['center-pen'], 'width-152')}>
                                <Anchor
                                    onClick={() => {
                                        actions.stopDraw();
                                    }}
                                >
                                    <div
                                        className={classNames('width-120', styles['center-pen-done'])}
                                    >
                                        <span>{i18n._('key-Laser/LeftBar-Draw Path Done')}</span>
                                    </div>
                                </Anchor>
                            </div>
                        </div>
                    )
                }
                {
                    mode === 'draw' && (
                        <div
                            className="position-absolute width-152 margin-left-72 margin-top-112 border-default-grey-1 border-radius-8 background-color-white"
                        >
                            <div className="border-bottom-normal padding-vertical-8 padding-horizontal-16 height-40">
                                {i18n._('key-Laser/LeftBar-Draw')}
                            </div>
                            <div className={classNames(styles['center-pen'], 'width-152')}>
                                <Anchor
                                    onClick={() => {
                                        actions.stopDraw();
                                    }}
                                >
                                    <div
                                        className={classNames('width-120', styles['center-pen-done'])}
                                    >
                                        <span>{i18n._('key-Laser/LeftBar-Draw Done')}</span>
                                    </div>
                                </Anchor>
                            </div>
                        </div>
                    )
                }
                {
                    extShape.showExtShape && mode === 'ext' && (
                        <div
                            style={{ 'height': 'calc(100vh - 26px - 68px - 12px)' }}
                            className={classNames('position-absolute overflow-hidden margin-left-72 margin-bottom-8 z-index-1 border-default-grey-1 border-radius-8 background-color-white', styles['width-366'])}
                        >
                            <div className="border-bottom-normal padding-horizontal-16 height-40">
                                {i18n._('key-Laser/LeftBar-Insert Shape')}
                            </div>
                            <div className={classNames('padding-horizontal-16 height-40', styles['online-libary'])}>
                                <span className={classNames(styles['negative-ml-12'])}>
                                    <SvgIcon
                                        type={['hoverNoBackground', 'pressSpecial']}
                                        color="#545659"
                                        size={14}
                                        name="MainToolbarModelRepository"
                                        disabled
                                        className={
                                            classNames('background-transparent',
                                                'padding-horizontal-4', 'position-re',
                                                styles['btn-center-ext'])
                                        }
                                    />
                                </span>
                                {i18n._('key-Laser/LeftBar-Online Libary Tip')}
                                {/* <span className={classNames(styles['blue-text'])}> {i18n._('key-Laser/LeftBar-Online Libary')}</span> */}

                                <span
                                    tabIndex={0}
                                    role="button"
                                    onClick={() => actions.openSvgShapeLibrary()}
                                    onKeyDown={() => actions.openSvgShapeLibrary()}
                                    className={classNames(styles['blue-text'])}
                                > {i18n._('key-Laser/LeftBar-Online Libary')}
                                </span>
                            </div>
                            <div className="overflow-y-auto border-radius-8" style={{ height: 'calc(100% - 40px - 40px - 5vh)' }}>
                                <div className="sm-flex">
                                    <div
                                        className={classNames(styles['center-ext'])}
                                    >
                                        {_.map(library.use, (key) => {
                                            return (
                                                <svg
                                                    key={key}
                                                    onClick={() => actions.createExt(key)}
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    role="button"
                                                    viewBox="0 0 300 300"
                                                    style={{ background: 'transparent', 'borderBottom': 0 }}
                                                    fill="#545659"
                                                    className={
                                                        classNames('background-transparent',
                                                            'padding-horizontal-4', 'position-re',
                                                            styles['btn-center-ext'],
                                                            { [styles.selected]: extShape === key })
                                                    }
                                                >
                                                    <path stroke="black" fill="none" strokeWidth="6.25" fillRule="evenodd" clipRule="evenodd" d={library.data[key]} />
                                                </svg>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div>

        </React.Fragment>
    );
});

SVGLeftBar.propTypes = {
    mode: PropTypes.string.isRequired,
    selectEditing: PropTypes.bool.isRequired,
    setMode: PropTypes.func.isRequired,
    insertDefaultTextVector: PropTypes.func.isRequired,
    onChangeFile: PropTypes.func.isRequired,
    onClickToUpload: PropTypes.func.isRequired,
    fileInput: PropTypes.object.isRequired,
    allowedFiles: PropTypes.string.isRequired,
    editable: PropTypes.bool,
    headType: PropTypes.string,
    onStartDraw: PropTypes.func.isRequired,
    onStopDraw: PropTypes.func.isRequired,
    createExt: PropTypes.func.isRequired,
    updateIsShowSVGShapeLibrary: PropTypes.func.isRequired
};


export default SVGLeftBar;
