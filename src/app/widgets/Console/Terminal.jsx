import color from 'cli-color';
// import trimEnd from 'lodash/trimEnd';
import PerfectScrollbar from 'perfect-scrollbar';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Terminal } from 'xterm';
import * as fit from 'xterm/lib/addons/fit/fit';
import log from '../../lib/log';
import History from './History';
import styles from './index.styl';

Terminal.applyAddon(fit);

// .widget-header-absolute widget-content-absolute
class TerminalWrapper extends PureComponent {
    static propTypes = {
        onData: PropTypes.func,
        defaultWidgets: PropTypes.array.isRequired
    };

    static defaultProps = {
        onData: () => {}
    };

    state = {
        inputHeight: 20
    }

    prompt = '> ';

    pressEnter = false;

    history = new History(1000);

    verticalScrollbar = null;

    terminalContainer = React.createRef();

    term = null;

    eventHandler = {
        onResize: () => {
            const { rows, cols } = this.term;
            log.debug(`Resizing the terminal to ${rows} rows and ${cols} cols`);

            if (this.verticalScrollbar) {
                this.verticalScrollbar.update();
            }
        },
        /*
        onKey: (() => {
            let historyCommand = '';

            return (key, event) => {
                const { onData } = this.props;
                const term = this.term;
                const line = term.buffer.lines.get(term.buffer.ybase + term.buffer.y);
                const nonPrintableKey = (event.altKey || event.altGraphKey || event.ctrlKey || event.metaKey);

                if (!line) {
                    return;
                }

                // Home
                if (event.key === 'Home' || (event.metaKey && event.key === 'ArrowLeft')) {
                    term.buffer.x = this.prompt.length;
                    return;
                }

                // End
                if (event.key === 'End' || (event.metaKey && event.key === 'ArrowRight')) {
                    let x = line.length - 1;
                    for (; x > this.prompt.length; --x) {
                        const c = line[x][1].trim();
                        if (c) {
                            break;
                        }
                    }

                    if ((x + 1) < (line.length - 1)) {
                        term.buffer.x = (x + 1);
                    }

                    return;
                }

                // Enter
                if (event.key === 'Enter') {
                    let buffer = '';
                    for (let x = this.prompt.length; x < line.length; ++x) {
                        const c = line[x][1] || '';
                        buffer += c;
                    }
                    buffer = trimEnd(buffer);

                    if (buffer.length > 0) {
                        // Clear history command
                        historyCommand = '';

                        // Reset the index to the last position of the history array
                        this.history.resetIndex();

                        // Push the buffer to the history list, not including the [Enter] key
                        this.history.push(buffer);
                    }

                    buffer += key;

                    log.debug('xterm>', buffer);

                    onData(buffer);
                    term.prompt();
                    return;
                }

                // Backspace
                if (event.key === 'Backspace') {
                    // Do not delete the prompt
                    if (term.buffer.x <= this.prompt.length) {
                        return;
                    }

                    for (let x = term.buffer.x; x < line.length; ++x) {
                        line[x - 1] = line[x];
                    }
                    line[line.length - 1] = [term.eraseAttr(), ' ', 1];
                    term.updateRange(term.buffer.y);
                    term.refresh(term.buffer.y, term.buffer.y);
                    term.write('\b');

                    return;
                }

                // Delete
                if (event.key === 'Delete') {
                    for (let x = term.buffer.x + 1; x < line.length; ++x) {
                        line[x - 1] = line[x];
                    }
                    line[line.length - 1] = [term.eraseAttr(), ' ', 1, 32];
                    term.updateRange(term.buffer.y);
                    term.refresh(term.buffer.y, term.buffer.y);

                    return;
                }

                // Escape
                if (event.key === 'Escape') {
                    term.eraseLine(term.buffer.y);
                    term.buffer.x = 0;
                    term.write(color.white(this.prompt));
                    return;
                }

                // ArrowLeft
                if (event.key === 'ArrowLeft') {
                    if (term.buffer.x > this.prompt.length) {
                        term.write(key);
                    }
                    return;
                }

                // ArrowRight
                if (event.key === 'ArrowRight') {
                    let x = line.length - 1;
                    for (; x > 0; --x) {
                        const c = line[x][1].trim();
                        if (c) {
                            break;
                        }
                    }
                    if (term.buffer.x <= x) {
                        term.write(key);
                    }

                    return;
                }

                // ArrowUp
                if (event.key === 'ArrowUp') {
                    if (!historyCommand) {
                        historyCommand = this.history.current() || '';
                    } else if (this.history.index > 0) {
                        historyCommand = this.history.back() || '';
                    }
                    term.eraseLine(term.buffer.y);
                    term.buffer.x = 0;
                    term.write(color.white(this.prompt));
                    term.write(color.white(historyCommand));
                    return;
                }

                // ArrowDown
                if (event.key === 'ArrowDown') {
                    historyCommand = this.history.forward() || '';
                    term.eraseLine(term.buffer.y);
                    term.buffer.x = 0;
                    term.write(color.white(this.prompt));
                    term.write(color.white(historyCommand));
                    return;
                }

                // PageUp
                if (event.key === 'PageUp') {
                    // Unsupported
                    return;
                }

                // PageDown
                if (event.key === 'PageDown') {
                    // Unsupported
                    return;
                }

                // Non-printable keys (e.g. ctrl-x)
                if (nonPrintableKey) {
                    onData(key);
                    return;
                }

                // Make sure the cursor position will not exceed the number of columns
                if (term.buffer.x < term.cols) {
                    let x = line.length - 1;
                    for (; x > term.buffer.x; --x) {
                        line[x] = line[x - 1];
                    }
                    term.write(color.white(key));
                }
            };
        })(),
        */
        onPaste: (data) => {
            const { onData } = this.props;
            const lines = String(data).replace(/(\r\n|\r|\n)/g, '\n').split('\n');
            for (let i = 0; i < lines.length; ++i) {
                const line = lines[i];
                onData(line);
                this.term.write(color.white(line));
                this.term.prompt();
            }
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
            this.pressEnter = true;
            this.writeln(`${this.prompt}${event.target.value}`);
            this.props.onData(event.target.value);
            // Reset the index to the last position of the history array
            this.history.resetIndex();
            this.history.push(event.target.value);
            event.target.value = '';
        }

        // Arrow Up
        if (event.keyCode === 38) {
            if (this.pressEnter) {
                event.target.value = this.history.current() || '';
                this.pressEnter = false;
            } else if (this.history.index > 0) {
                event.target.value = this.history.back() || '';
            }
        }

        // Arrow Down
        if (event.keyCode === 40) {
            event.target.value = this.history.forward() || '';
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
        const height = this.terminalContainer.current.parentElement.clientHeight || 300;
        const rows = Math.floor(height / lineHeight) - rowOffset;
        const inputHeight = height - rows * lineHeight;
        this.setState({
            inputHeight
        });
        if (rows > minRows) {
            this.term.resize(cols, rows);
        } else {
            this.term.resize(cols, minRows);
        }
    }

    clear() {
        if (this.term) {
            this.term.clear();
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

    writeln(data) {
        if (this.term) {
            this.term.eraseRight(0, this.term.buffer.y);
            this.term.write('\r');
            this.term.write(data);
            this.term.prompt();
        }
    }

    render() {
        const defaultWidgets = this.props.defaultWidgets;
        const isToggled = defaultWidgets.find(wid => wid === 'console') !== undefined;
        const inputHeight = `${this.state.inputHeight}px`;
        return (
            <div
                className={isToggled ? styles.terminalContentAbsolute : styles.terminalContent}
            >
                <div
                    ref={this.terminalContainer}
                />
                <input
                    style={{ width: '100%', height: inputHeight, backgroundColor: '#000000', color: '#FFFFFF', border: 'none' }}
                    type="text"
                    placeholder="Send Command"
                    onKeyDown={(event) => {
                        this.setTerminalInput(event);
                    }}
                />
            </div>
        );
    }
}

export default TerminalWrapper;
