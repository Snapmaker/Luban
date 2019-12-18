import color from 'cli-color';
// import trimEnd from 'lodash/trimEnd';
import PerfectScrollbar from 'perfect-scrollbar';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Terminal } from 'xterm';
import * as fit from 'xterm/lib/addons/fit/fit';
import log from '../../lib/log';
import styles from './index.styl';

Terminal.applyAddon(fit);

// .widget-header-absolute widget-content-absolute
class TerminalWrapper extends PureComponent {
    static propTypes = {
        onData: PropTypes.func,
        isDefault: PropTypes.bool.isRequired,
        terminalHistory: PropTypes.object.isRequired,
        history: PropTypes.object.isRequired,
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

    eventHandler = {
        onResize: () => {
            const { rows, cols } = this.term;
            log.debug(`Resizing the terminal to ${rows} rows and ${cols} cols`);

            if (this.verticalScrollbar) {
                this.verticalScrollbar.update();
            }
        },
        onPaste: (data) => {
            const { onData } = this.props;
            const lines = String(data).replace(/(\r\n|\r|\n)/g, '\n').split('\n');
            for (let i = 0; i < lines.length; ++i) {
                const line = lines[i];
                onData(line);
                this.term.write(color.white(line));
                this.term.prompt();
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
            cursorBlink: false,
            scrollback: 1000,
            tabStopWidth: 4
        });
        this.term.prompt = () => {
            this.term.write('\r\n');
            // this.term.write(color.white(this.prompt));
        };
        this.term.on('resize', this.eventHandler.onResize);
        // this.term.on('key', this.eventHandler.onKey);
        this.term.on('paste', this.eventHandler.onPaste);

        this.term.on('focus', this.eventHandler.onFocus);

        const el = this.terminalContainer.current;

        this.term.open(el);
        this.term.fit();
        this.term.focus(false);

        this.term.setOption('fontFamily', 'Consolas, Menlo, Monaco, Lucida Console, Liberation Mono, DejaVu Sans Mono, Bitstream Vera Sans Mono, Courier New, monospace, serif');
        const xtermElement = el.querySelector('.xterm');
        xtermElement.style.paddingLeft = '3px';
        const viewportElement = el.querySelector('.xterm-viewport');
        this.verticalScrollbar = new PerfectScrollbar(viewportElement);
        // bind this
        window.addEventListener('resize', this.resize.bind(this), false);
        // bugfix: resize when oepn/close serial port
        this.resize();
    }

    componentWillUnmount() {
        if (this.verticalScrollbar) {
            this.verticalScrollbar.destroy();
            this.verticalScrollbar = null;
        }
        if (this.term) {
            this.term.off('resize', this.eventHandler.onResize);
            // this.term.off('key', this.eventHandler.onKey);
            this.term.off('paste', this.eventHandler.onPaste);
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
            // Reset the index to the last position of the history array
            this.props.history.push(event.target.value);
            event.target.value = '';

            this.setState({
                inputValue: event.target.value
            });
            this.props.terminalHistory.set(0, event.target.value);
        }

        // Arrow Up
        if (event.keyCode === 38) {
            event.target.value = this.props.history.back() || '';
            this.props.terminalHistory.set(0, event.target.value);
        }

        // Arrow Down
        if (event.keyCode === 40) {
            event.target.value = this.props.history.forward() || '';
            this.props.terminalHistory.set(0, event.target.value);
        }
    }

    resize() {
        if (!(this.term && this.term.element)) {
            return;
        }

        const geometry = fit.proposeGeometry(this.term);
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
        const inputHeight = height - (this.terminalContainer.current.clientHeight || rows * lineHeight);
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
            this.term.eraseRight(0, this.term.buffer.y);
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
                className={isDefault ? styles.terminalContentAbsolute : styles.terminalContent}
            >
                <div
                    ref={this.terminalContainer}
                />
                <input
                    ref={this.input}
                    style={{ width: '100%', height: inputHeight, backgroundColor: '#000000', color: '#FFFFFF', border: 'none' }}
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
