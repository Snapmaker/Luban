import * as React from 'react';
import CSSMotion from 'rc-motion';
import classNames from 'classnames';
import useLayoutEffect from 'rc-util/lib/hooks/useLayoutEffect';
import { composeRef } from 'rc-util/lib/ref';
import { SegmentedValue } from './RcSegmented';

type ThumbReact = {
    left: number;
    width: number;
} | null;

export interface MotionThumbInterface {
    containerRef: React.RefObject<HTMLDivElement>;
    value: SegmentedValue;
    getValueIndex: (value: SegmentedValue) => number;
    prefixCls: string;
    motionName: string;
    onMotionStart: VoidFunction;
    onMotionEnd: VoidFunction;
}

const calcThumbStyle = (
    targetElement: HTMLElement | null | undefined,
): ThumbReact => (targetElement
    ? {
        left: targetElement.offsetLeft,
        width: targetElement.clientWidth,
    }
    : null);

const toPX = (value: number) => (value !== undefined ? `${value}px` : undefined);

function MotionThumb(props: MotionThumbInterface) {
    const {
        prefixCls,
        containerRef,
        value,
        getValueIndex,
        motionName,
        onMotionStart,
        onMotionEnd,
    } = props;

    const thumbRef = React.useRef<HTMLDivElement>(null);
    const [prevValue, setPrevValue] = React.useState(value);

    // =========================== Effect ===========================
    const findValueElement = (val: SegmentedValue) => {
        const index = getValueIndex(val);

        const ele = containerRef.current?.querySelectorAll<HTMLDivElement>(
            `.${prefixCls}-item`,
        )[index];

        return ele;
    };

    const [prevStyle, setPrevStyle] = React.useState<ThumbReact>(null);
    const [nextStyle, setNextStyle] = React.useState<ThumbReact>(null);

    useLayoutEffect(() => {
        if (prevValue !== value) {
            const prev = findValueElement(prevValue);
            const next = findValueElement(value);

            const calcPrevStyle = calcThumbStyle(prev);
            const calcNextStyle = calcThumbStyle(next);

            setPrevValue(value);
            setPrevStyle(calcPrevStyle);
            setNextStyle(calcNextStyle);

            if (prev && next) {
                onMotionStart();
            } else {
                onMotionEnd();
            }
        }
    }, [value]);

    // =========================== Motion ===========================
    const onAppearStart = () => {
        return {
            transform: 'translateX(var(--thumb-start-left))',
            width: 'var(--thumb-start-width)',
        };
    };
    const onAppearActive = () => {
        return {
            transform: 'translateX(var(--thumb-active-left))',
            width: 'var(--thumb-active-width)',
        };
    };
    const onAppearEnd = () => {
        setPrevStyle(null);
        setNextStyle(null);
        onMotionEnd();
    };

    // =========================== Render ===========================
    // No need motion when nothing exist in queue
    if (!prevStyle || !nextStyle) {
        return null;
    }

    return (
        <CSSMotion
            visible
            motionName={motionName}
            motionAppear
            onAppearStart={onAppearStart}
            onAppearActive={onAppearActive}
            onAppearEnd={onAppearEnd}
        >
            {({ className: motionClassName, style: motionStyle }, ref) => {
                const mergedStyle = {
                    ...motionStyle,
                    '--thumb-start-left': toPX(prevStyle?.left),
                    '--thumb-start-width': toPX(prevStyle?.width),
                    '--thumb-active-left': toPX(nextStyle?.left),
                    '--thumb-active-width': toPX(nextStyle?.width),
                } as React.CSSProperties;

                // It's little ugly which should be refactor when @umi/test update to latest jsdom
                const motionProps = {
                    ref: composeRef(thumbRef, ref),
                    style: mergedStyle,
                    className: classNames(`${prefixCls}-thumb`, motionClassName),
                };

                if (process.env.NODE_ENV === 'test') {
                    (motionProps as any)['data-test-style'] = JSON.stringify(mergedStyle);
                }

                return <div {...motionProps} />;
            }}
        </CSSMotion>
    );
}

export default MotionThumb;
