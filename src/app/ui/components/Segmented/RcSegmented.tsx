import * as React from 'react';
import classNames from 'classnames';
import useMergedState from 'rc-util/lib/hooks/useMergedState';
import { composeRef } from 'rc-util/lib/ref';
import omit from 'rc-util/lib/omit';

import MotionThumb from './MotionThumb';

export type SegmentedValue = string | number;

export type SegmentedRawOption = SegmentedValue;

export interface SegmentedLabeledOption {
    className?: string;
    disabled?: boolean;
    label: React.ReactNode;
    value: SegmentedRawOption;
    /**
     * html `title` property for label
     */
    title?: string;
}

type SegmentedOptions = (SegmentedRawOption | SegmentedLabeledOption)[];

export interface SegmentedProps
    extends Omit<React.HTMLProps<HTMLDivElement>, 'onChange'> {
    options?: SegmentedOptions;
    defaultValue?: SegmentedValue;
    value?: SegmentedValue;
    onChange?: (value: SegmentedValue) => void;
    disabled?: boolean;
    prefixCls?: string;
    direction?: 'ltr' | 'rtl';
    motionName?: string;
}

function getValidTitle(option: SegmentedLabeledOption) {
    if (typeof option.title !== 'undefined') {
        return option.title;
    }

    // read `label` when title is `undefined`
    if (typeof option.label !== 'object') {
        return option.label?.toString();
    }

    return '';
}

function normalizeOptions(options: SegmentedOptions): any[] {
    return options.map((option) => {
        if (typeof option === 'object' && option !== null) {
            const validTitle = getValidTitle(option);

            return {
                ...option,
                title: validTitle,
            };
        }

        return {
            label: option?.toString(),
            title: option?.toString(),
            value: option,
        };
    });
}

const InternalSegmentedOption: React.FC<{
    prefixCls: string;
    className?: string;
    disabled?: boolean;
    checked: boolean;
    label: React.ReactNode;
    title?: string;
    value: SegmentedRawOption;
    onChange: (
        e: React.ChangeEvent<HTMLInputElement>,
        value: SegmentedRawOption,
    ) => void;
}> = ({
    prefixCls,
    className,
    disabled,
    checked,
    label,
    title,
    value,
    onChange,
}) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) {
            return;
        }

        onChange(event, value);
    };

    return (
        <label
            className={classNames(className, {
                [`${prefixCls}-item-disabled`]: disabled,
            })}
        >
            <input
                className={`${prefixCls}-item-input`}
                type="radio"
                disabled={disabled}
                checked={checked}
                onChange={handleChange}
            />
            <div className={`${prefixCls}-item-label`} title={title}>
                {label}
            </div>
        </label>
    );
};

const Segmented = React.forwardRef<HTMLDivElement, SegmentedProps>(
    (props, ref) => {
        const {
            prefixCls = 'rc-segmented',
            direction,
            options,
            disabled,
            defaultValue,
            value,
            onChange,
            className = '',
            motionName = 'thumb-motion',
            ...restProps
        } = props;

        const containerRef = React.useRef<HTMLDivElement>(null);
        const mergedRef = React.useMemo(
            () => composeRef<HTMLDivElement>(containerRef, ref),
            [containerRef, ref],
        );

        const segmentedOptions = React.useMemo(() => {
            return normalizeOptions(options);
        }, [options]);

        // Note: We should not auto switch value when value not exist in options
        // which may break single source of truth.
        const [rawValue, setRawValue] = useMergedState(segmentedOptions[0]?.value, {
            value,
            defaultValue,
        });

        // ======================= Change ========================
        const [thumbShow, setThumbShow] = React.useState(false);

        const handleChange = (
            event: React.ChangeEvent<HTMLInputElement>,
            val: SegmentedRawOption,
        ) => {
            if (disabled) {
                return;
            }

            setRawValue(val);

            onChange?.(val);
        };

        const divProps = omit(restProps, ['children']);

        React.useEffect(() => {
            setRawValue(value);
        }, [value]);

        return (
            <div
                {...divProps}
                className={classNames(
                    prefixCls,
                    {
                        [`${prefixCls}-rtl`]: direction === 'rtl',
                        [`${prefixCls}-disabled`]: disabled,
                    },
                    className,
                )}
                ref={mergedRef}
            >
                <MotionThumb
                    prefixCls={prefixCls}
                    value={rawValue}
                    containerRef={containerRef}
                    motionName={`${prefixCls}-${motionName}`}
                    getValueIndex={(val) => segmentedOptions.findIndex((n) => n.value === val)}
                    onMotionStart={() => {
                        setThumbShow(true);
                    }}
                    onMotionEnd={() => {
                        setThumbShow(false);
                    }}
                />
                {segmentedOptions.map((segmentedOption) => (
                    <InternalSegmentedOption
                        key={segmentedOption.value}
                        prefixCls={prefixCls}
                        className={classNames(
                            segmentedOption.className,
                            `${prefixCls}-item`,
                            {
                                [`${prefixCls}-item-selected`]:
                                        segmentedOption.value === rawValue && !thumbShow,
                            },
                        )}
                        checked={segmentedOption.value === rawValue}
                        onChange={handleChange}
                        {...segmentedOption}
                        disabled={!!disabled || !!segmentedOption.disabled}
                    />
                ))}
            </div>
        );
    },
);

Segmented.displayName = 'Segmented';

Segmented.defaultProps = {
    options: []
};

export default Segmented;
