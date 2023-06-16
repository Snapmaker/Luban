import type { MachineModule } from '@snapmaker/luban-platform';

export type QuickSwapKitModule = MachineModule & {
    metadata: {
        workRangeOffset?: number[];
    };
};

export const quickSwapKitModule: QuickSwapKitModule = {
    identifier: 'snapmaker-2.0-quick-swap-module',

    name: 'Snapmaker 2.0 Quick Swap Kit',

    metadata: {

    }
};
