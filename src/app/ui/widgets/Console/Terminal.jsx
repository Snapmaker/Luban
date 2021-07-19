import color from 'cli-color';
// import trimEnd from 'lodash/trimEnd';
import PerfectScrollbar from 'perfect-scrollbar';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import UniApi from '../../../lib/uni-api';
import log from '../../../lib/log';
import styles from './index.styl';

// .widget-header-absolute widget-content-absolute
class TerminalWrapper extends PureComponent {
    static propTypes = {
        onData: PropTypes.func,
        isDefault: PropTypes.bool,
        terminalHistory: PropTypes.object.isRequired,
        shouldRenderFitaddon: PropTypes.bool.isRequired,
        consoleHistory: PropTypes.object.isRequired,
        inputValue: PropTypes.string.isRequired
    };

    state = {
        inputValue: this.props.inputValue,
        inputHeight: 20
    }

    actions = {
        changeInputValue: (event) => {
            this.setState({
                inputValue: event.target.value
            });
            this.props.terminalHistory.set(0, event.target.value);
        }
    }

    prompt = '> ';

    verticalScrollbar = null;

    terminalContainer = React.createRef();

    input = React.createRef();

    term = null;

    fitAddon = null;

    eventHandler = {
        onResize: () => {
            const { rows, cols } = this.term;
            log.debug(`Resizing the terminal to ${rows} rows and ${cols} cols`);

            if (this.verticalScrollbar) {
                this.verticalScrollbar.update();
            }
        },
        onPaste: (data) => {
            if (document.activeElement === this.input) {
                const { onData } = this.props;
                const lines = String(data).replace(/(\r\n|\r|\n)/g, '\n').split('\n');
                for (let i = 0; i < lines.length; ++i) {
                    const line = lines[i];
                    onData(line);
                    this.term.write(color.white(line));
                    this.term.prompt();
                }
            }
        },
        onFocus: () => {
            this.input.current.focus();
        }
    };

    componentDidMount() {
        this.term = new Terminal({
            rows: 16,
            // bar, block, underline
            cursorStyle: 'block',
            theme: {
                // set cursor color the same to the background, for hiding
                cursor: 'black'
            },
            cursorBlink: false,
            scrollback: 1000,
            tabStopWidth: 4
        });
        this.term.prompt = () => {
            this.term.write('\r\n');
        };
        this.term.onResize(this.eventHandler.onResize);
        this.term.onData(this.eventHandler.onPaste);
        this.term.onKey(
            (e) => {
                const { domEvent } = e;
                // // control + a
                // if (domEvent.ctrlKey && domEvent.key === 'a') {
                //     this.term.selectAll();
                //     document.execCommand('copy');
                // }
                // control + c
                if (domEvent.ctrlKey && domEvent.key === 'c') {
                    UniApi.Window.copySelection(this.term.getSelection());
                }
            }
        );

        const el = this.terminalContainer.current;
        this.term.open(el);
        const viewport = el.getElementsByClassName('terminal')[0];
        viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
        });
        this.term.focus(false);

        this.term.setOption('fontFamily', 'Consolas, Menlo, Monaco, Lucida Console, Liberation Mono, DejaVu Sans Mono, Bitstream Vera Sans Mono, Courier New, monospace, serif');
        const xtermElement = el.querySelector('.xterm');
        xtermElement.style.paddingLeft = '3px';
        const viewportElement = el.querySelector('.xterm-viewport');
        this.verticalScrollbar = new PerfectScrollbar(viewportElement);
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.shouldRenderFitaddon !== nextProps.shouldRenderFitaddon && nextProps.shouldRenderFitaddon) {
            if (!this.fitAddon && this.term) {
                this.fitAddon = new FitAddon();
                this.term.loadAddon(this.fitAddon);
            }
        }
    }

    componentWillUnmount() {
        if (this.verticalScrollbar) {
            this.verticalScrollbar.destroy();
            this.verticalScrollbar = null;
        }
        if (this.term) {
            this.term.dispose();
            this.term = null;
        }
    }

    // http://www.alexandre-gomes.com/?p=115
    getScrollbarWidth() {
        const inner = document.createElement('p');
        inner.style.width = '100%';
        inner.style.height = '200px';

        const outer = document.createElement('div');
        outer.style.position = 'absolute';
        outer.style.top = '0px';
        outer.style.left = '0px';
        outer.style.visibility = 'hidden';
        outer.style.width = '200px';
        outer.style.height = '150px';
        outer.style.overflow = 'hidden';
        outer.appendChild(inner);

        document.body.appendChild(outer);
        const w1 = inner.offsetWidth;
        outer.style.overflow = 'scroll';
        const w2 = (w1 === inner.offsetWidth) ? outer.clientWidth : inner.offsetWidth;
        document.body.removeChild(outer);

        return (w1 - w2);
    }

    setTerminalInput(event) {
        // Enter
        if (event.keyCode === 13) {
            this.writeln(`${this.prompt}${event.target.value}`);
            this.props.onData(event.target.value);
            // Reset the index to the last position of the location array
            this.props.consoleHistory.push(event.target.value);
            event.target.value = '';

            this.setState({
                inputValue: event.target.value
            });
            this.props.terminalHistory.set(0, event.target.value);
        }

        // Arrow Up
        if (event.keyCode === 38) {
            event.target.value = this.props.consoleHistory.back() || '';
            this.props.terminalHistory.set(0, event.target.value);
        }

        // Arrow Down
        if (event.keyCode === 40) {
            event.target.value = this.props.consoleHistory.forward() || '';
            this.props.terminalHistory.set(0, event.target.value);
        }
    }


    resize() {
        if (!(this.term && this.term.element)) {
            return;
        }
        const geometry = this.fitAddon && this.fitAddon.proposeDimensions(this.term);
        if (!geometry) {
            return;
        }

        let cols = 36;
        if (geometry.cols && geometry.cols !== Infinity) {
            cols = geometry.cols;
        }
        // xtermjs line height
        const lineHeight = 18;
        const minRows = 12;
        const rowOffset = 2;
        const height = this.terminalContainer.current.parentElement.clientHeight < 300
            ? 300 : this.terminalContainer.current.parentElement.clientHeight;
        const rows = Math.floor(height / lineHeight) - rowOffset;
        if (rows > minRows) {
            this.term.resize(cols, rows);
        } else {
            this.term.resize(cols, minRows);
        }
        const inputHeight = height - (this.terminalContainer.current.clientHeight || rows * lineHeight) - 1;
        this.setState({
            inputHeight
        });
    }

    clear(isHistory = true) {
        if (this.term) {
            this.term.clear();
            if (isHistory) {
                this.props.terminalHistory.clear();
                this.props.terminalHistory.push('');
            }
        }
    }

    selectAll() {
        if (this.term) {
            this.term.selectAll();
        }
    }

    clearSelection() {
        if (this.term) {
            this.term.clearSelection();
        }
    }

    write(data) {
        if (this.term) {
            this.term.write(data);
        }
    }

    writeln(data, isHistory = true) {
        if (this.term) {
            this.term.write('\r');
            this.term.write(data);
            this.term.prompt();
            if (isHistory) {
                this.props.terminalHistory.push(data);
            }
        }
    }

    render() {
        const { isDefault, terminalHistory } = this.props;
        const { inputValue } = this.state;

        const inputHeight = `${this.state.inputHeight}px`;
        return (
            <div
                className={isDefault ? styles['terminal-content-absolute'] : styles['terminal-content']}
            >
                <div ref={this.terminalContainer} />
                <div style={{
                    height: '1px',
                    backgroundColor: '#676869'
                }}
                />
                <input
                    ref={this.input}
                    style={{
                        width: '100%',
                        height: inputHeight,
                        backgroundColor: '#000000',
                        color: '#FFFFFF',
                        border: 'none'
                    }}
                    type="text"
                    placeholder="Send Command"
                    value={terminalHistory.get(0) === undefined ? inputValue : terminalHistory.get(0)}
                    onChange={this.actions.changeInputValue}
                    onKeyDown={(event) => {
                        this.setTerminalInput(event);
                    }}
                />
            </div>
        );
    }
}

export default TerminalWrapper;
