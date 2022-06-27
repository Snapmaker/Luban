import * as React from 'react';

export interface CSPConfig {
  nonce?: string;
}
export type SizeType = 'small' | 'middle' | 'large' | undefined;

export type DirectionType = 'ltr' | 'rtl' | undefined;

export interface ConfigConsumerProps {
  getTargetContainer?: () => HTMLElement;
  getPopupContainer?: (triggerNode?: HTMLElement) => HTMLElement;
  rootPrefixCls?: string;
  iconPrefixCls?: string;
  getPrefixCls: (suffixCls?: string, customizePrefixCls?: string) => string;
  csp?: CSPConfig;
  autoInsertSpaceInButton?: boolean;
  input?: {
    autoComplete?: string;
  };
  pagination?: {
    showSizeChanger?: boolean;
  };
  pageHeader?: {
    ghost: boolean;
  };
  direction?: DirectionType;
  space?: {
    size?: SizeType | number;
  };
  virtual?: boolean;
  dropdownMatchSelectWidth?: boolean;
}

const defaultGetPrefixCls = (suffixCls?: string, customizePrefixCls?: string) => {
    if (customizePrefixCls) return customizePrefixCls;

    return suffixCls ? `ant-${suffixCls}` : 'ant';
};

// zombieJ: 🚨 Do not pass `defaultRenderEmpty` here since it will case circular dependency.
export const ConfigContext = React.createContext<ConfigConsumerProps>({
    // We provide a default function for Context without provider
    getPrefixCls: defaultGetPrefixCls,
});
