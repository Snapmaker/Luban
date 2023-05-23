import color from 'cli-color';
// import trimEnd from 'lodash/trimEnd';
import PerfectScrollbar from 'perfect-scrollbar';
import PropTypes from 'prop-types';
import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import UniApi from '../../../lib/uni-api';
import log from '../../../lib/log';
import styles from './index.styl';

// .widget-header-absolute widget-content-absolute
const prompt = '> ';
let verticalScrollbar = null;
let term = null;
let fitAddon = null;

const TerminalWrapper = forwardRef(({ inputValue: inputValueProp, terminalHistory, onData, consoleHistory, isDefault }, ref) => {
    const [inputValue, setInputValue] = useState(inputValueProp);
    const [inputHeight, setInputHeight] = useState(20);
    const terminalContainer = useRef();
    const input = useRef();
    const actions = {
        changeInputValue: (event) => {
            setInputValue(event.target.value);
            terminalHistory.set(0, event.target.value);
        }
    };

    const eventHandler = {
        onResize: () => {
            const { rows, cols } = term;
            log.debug(`Resizing the terminal to ${rows} rows and ${cols} cols`);

            if (verticalScrollbar) {
                verticalScrollbar.update();
            }
        },
        onPaste: (data) => {
            if (document.activeElement === input) {
                const lines = String(data).replace(/(\r\n|\r|\n)/g, '\n').split('\n');
                for (let i = 0; i < lines.length; ++i) {
                    const line = lines[i];
                    onData(line);
                    term.write(color.white(line));
                    term.prompt();
                }
            }
        },
        onFocus: () => {
            input.current.focus();
        }
    };

    useEffect(() => {
        term = new Terminal({
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
        term.prompt = () => {
            term.write('\r\n');
        };
        term.onResize(eventHandler.onResize);
        term.onData(eventHandler.onPaste);
        term.onKey(
            (e) => {
                const { domEvent } = e;
                // // control + a
                // if (domEvent.ctrlKey && domEvent.key === 'a') {
                //     term.selectAll();
                //     document.execCommand('copy');
                // }
                // control + c
                if (domEvent.ctrlKey && domEvent.key === 'c') {
                    UniApi.Window.copySelection(term.getSelection());
                }
            }
        );

        fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        const el = terminalContainer.current;
        term.open(el);
        const viewport = el.getElementsByClassName('terminal')[0];
        viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
        });
        term.focus(false);

        term.setOption('fontFamily', 'Consolas, Menlo, Monaco, Lucida Console, Liberation Mono, DejaVu Sans Mono, Bitstream Vera Sans Mono, Courier New, monospace, serif');
        const xtermElement = el.querySelector('.xterm');
        xtermElement.style.paddingLeft = '3px';
        const viewportElement = el.querySelector('.xterm-viewport');
        verticalScrollbar = new PerfectScrollbar(viewportElement);

        return () => {
            if (verticalScrollbar) {
                verticalScrollbar.destroy();
                verticalScrollbar = null;
            }
            if (term) {
                term.dispose();
                term = null;
            }
        };
    }, []);

    function writeln(data, isHistory = true) {
        if (term) {
            term.write('\r');
            term.write(data);
            term.prompt();
            if (isHistory) {
                terminalHistory.push(data);
            }
        }
    }

    function setTerminalInput(event) {
        // Enter
        if (event.keyCode === 13) {
            writeln(`${prompt}${event.target.value}`);
            onData(event.target.value);
            // Reset the index to the last position of the location array
            consoleHistory.push(event.target.value);
            event.target.value = '';
            setInputValue(event.target.value);
            terminalHistory.set(0, event.target.value);
        }

        // Arrow Up
        if (event.keyCode === 38) {
            event.target.value = consoleHistory.back() || '';
            terminalHistory.set(0, event.target.value);
        }

        // Arrow Down
        if (event.keyCode === 40) {
            event.target.value = consoleHistory.forward() || '';
            terminalHistory.set(0, event.target.value);
        }
    }

    function resize() {
        if (!(term && term.element)) {
            return;
        }
        const geometry = fitAddon && fitAddon.proposeDimensions(term);
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
        const height = terminalContainer.current.parentElement.clientHeight < 300
            ? 300 : terminalContainer.current.parentElement.clientHeight;
        const rows = Math.floor(height / lineHeight) - rowOffset;
        if (rows > minRows) {
            term.resize(cols, rows);
        } else {
            term.resize(cols, minRows);
        }
        const _inputHeight = height - (terminalContainer.current.clientHeight || rows * lineHeight) - 1;
        setInputHeight(_inputHeight);
    }

    function clear(isHistory = true) {
        if (term) {
            term.clear();
            if (isHistory) {
                terminalHistory.clear();
                terminalHistory.push('');
            }
        }
    }

    function selectAll() {
        if (term) {
            term.selectAll();
        }
    }

    function clearSelection() {
        if (term) {
            term.clearSelection();
        }
    }

    function write(data) {
        if (term) {
            term.write(data);
        }
    }

    useImperativeHandle(ref, () => ({
        writeln,
        setTerminalInput,
        resize,
        clear,
        selectAll,
        clearSelection,
        write
    }));

    const command = terminalHistory.getLength() > 0 ? terminalHistory.get(0) : inputValue;

    return (
        <div
            className={isDefault ? styles['terminal-content-absolute'] : styles['terminal-content']}
        >
            <div ref={terminalContainer} />
            <div style={{
                height: '1px',
                backgroundColor: '#676869'
            }}
            />
            <input
                ref={input}
                style={{
                    width: '100%',
                    height: `${inputHeight}px`,
                    backgroundColor: '#000000',
                    color: '#FFFFFF',
                    border: 'none'
                }}
                type="text"
                placeholder="Send Command"
                value={command}
                onChange={actions.changeInputValue}
                onKeyDown={(event) => {
                    setTerminalInput(event);
                }}
            />
        </div>
    );
});

TerminalWrapper.propTypes = {
    onData: PropTypes.func,
    isDefault: PropTypes.bool,
    terminalHistory: PropTypes.object.isRequired,
    consoleHistory: PropTypes.object.isRequired,
    inputValue: PropTypes.string.isRequired
};
export default TerminalWrapper;
