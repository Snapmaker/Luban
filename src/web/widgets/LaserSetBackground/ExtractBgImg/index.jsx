import React, { PureComponent } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import i18n from '../../../lib/i18n';
import styles from './../styles.styl';
import ExtractingPreview from './ExtractingPreview';


class ExtractBgImg extends PureComponent {
    static propTypes = {
        state: PropTypes.shape({
            sideLength: PropTypes.number.isRequired
        }),
        actions: PropTypes.shape({
            changeBgImgFilename: PropTypes.func.isRequired
        })
    };

    extractingPreviewNode = null;

    actions = {
        onClickToUpload: () => {
            this.fileInputEl.value = null;
            this.fileInputEl.click();
        },
        onChangeFile: (event) => {
            const file = event.target.files[0];
            this.extractingPreviewNode.uploadPhoto(file);
        },
        reset: () => {
            this.extractingPreviewNode.reset();
        },
        extract: () => {
            this.extractingPreviewNode.extract(
                this.props.state.sideLength,
                (bgImgFilename) => {
                    this.props.actions.changeBgImgFilename(bgImgFilename);
                }
            );
        }
    };

    render() {
        const actions = this.actions;

        return (
            <React.Fragment>
                <input
                    ref={(node) => {
                        this.fileInputEl = node;
                    }}
                    type="file"
                    accept=".png, .jpg, .jpeg, .bmp"
                    style={{ display: 'none' }}
                    multiple={false}
                    onChange={actions.onChangeFile}
                />
                <div style={{ height: '550px', padding: '1px', width: '404px', borderWidth: '1px', borderStyle: 'solid', borderColor: '#e0e0e0' }}>
                    <ExtractingPreview
                        ref={node => {
                            this.extractingPreviewNode = node;
                        }}
                    />
                    <div style={{ marginLeft: '35px', marginRight: '35px', marginTop: '10px' }}>
                        <button
                            type="button"
                            className={classNames(styles['btn-large'], styles['btn-primary'])}
                            onClick={actions.onClickToUpload}
                            style={{ display: 'block', width: '100%', marginTop: '5px' }}
                        >
                            {i18n._('Upload Photo')}
                        </button>
                        <button
                            type="button"
                            className={classNames(styles['btn-large'], styles['btn-primary'])}
                            onClick={actions.reset}
                            style={{ display: 'block', width: '100%', marginTop: '5px' }}
                        >
                            {i18n._('Reset')}
                        </button>
                        <button
                            type="button"
                            className={classNames(styles['btn-large'], styles['btn-primary'])}
                            onClick={actions.extract}
                            style={{ display: 'block', width: '100%', marginTop: '5px' }}
                        >
                            {i18n._('Extract')}
                        </button>
                    </div>
                </div>
            </React.Fragment>
        );
    }
}

export default ExtractBgImg;

