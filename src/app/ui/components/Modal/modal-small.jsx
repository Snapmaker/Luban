import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import ReactDOM from 'react-dom';
import i18n from '../../../lib/i18n';
import { Button } from '../Buttons';
import SvgIcon from '../SvgIcon';
import Modal from './index';
import styles from './styles.styl';

export class ModalSmallHOC extends PureComponent {
    static propTypes = {
        ...Modal.propTypes,
        container: PropTypes.object,
        showCloseButton: PropTypes.bool,
        img: PropTypes.string,
        iconColor: PropTypes.string,
        title: PropTypes.string.isRequired,
        subtext: PropTypes.string,
        text: PropTypes.string
    };


    static defaultProps = {
        ...Modal.defaultProps
    };

    state = {
        show: true
    };

    handleClose = () => {
        this.setState({ show: false });
        setTimeout(() => {
            this.removeContainer();
            this.props.onClose && this.props.onClose();
            this.props.onCancel && this.props.onCancel();
        });
    };

    handleConfirm = () => {
        this.setState({ show: false });
        setTimeout(() => {
            this.removeContainer();
            this.props.onClose && this.props.onClose();
            this.props.onConfirm && this.props.onConfirm();
        });
    };

    removeContainer() {
        const { container } = this.props;
        ReactDOM.unmountComponentAtNode(container);
        container.remove();
    }

    render() {
        const { onCancel, onConfirm, showCloseButton = true, ...rest } = this.props;
        const { show } = this.state;
        const img = this.props.img || '';
        const iconColor = this.props.iconColor;
        const isImage = new RegExp(/^\.\.\//).test(img);
        const text = this.props.text;
        const subtext = this.props.subtext;
        const title = this.props.title;

        return (
            <Modal
                {...rest}
                showCloseButton={showCloseButton}
                onClose={this.handleClose}
                show={show}
            >
                <Modal.Body style={{
                    marginBottom: '42px'
                }}
                >
                    <div className={styles['modal-small-img']}>
                        {!isImage && (
                            <SvgIcon
                                name={img}
                                size={72}
                                color={iconColor}
                                type={['static']}
                            />
                        )}
                        {isImage && (<img src={img} alt="......" />)}
                    </div>
                    <div className={styles[`${isImage ? 'modal-small-body-text' : 'modal-small-body-text-svg'}`]}>
                        {i18n._(title)}
                    </div>
                    {text && (
                        <div className={styles['modal-small-body-hit']}>
                            {i18n._(text)}
                        </div>
                    )}
                    {subtext && (
                        <div className={styles['modal-small-body-hit']}>
                            {i18n._(subtext)}
                        </div>
                    )}

                </Modal.Body>
                {onCancel && onConfirm && (
                    <Modal.Footer>
                        <Button
                            priority="level-two"
                            className="margin-left-8"
                            width="96px"
                            type="default"
                            onClick={this.handleClose}
                        >
                            {i18n._('key-Modal/Common-Cancel')}
                        </Button>
                        <Button
                            priority="level-two"
                            className="margin-left-8"
                            width="96px"
                            onClick={this.handleConfirm}
                        >
                            {i18n._('key-Modal/Common-Confirm')}
                        </Button>
                    </Modal.Footer>
                )}
            </Modal>
        );
    }
}
export default (options) => {
    const ref = React.createRef();
    const container = document.createElement('div');
    document.body.appendChild(container);

    const props = {
        ...options,
        // onClose: () => {
        //     resolve();
        // },
        container: container
    };
    ReactDOM.render(<ModalSmallHOC ref={ref} {...props} />, container);

    return {
        ref: ref
    };
};
