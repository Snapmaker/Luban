import type { MachineModule } from '@snapmaker/luban-platform';

export type QuickSwapKitModule = MachineModule & {
    metadata: {
        workRangeOffset?: number[];
    };
};
export type BracingKit = MachineModule & {
    metadata: {
        workRangeOffset?: number[];
    };
}

export const quickSwapKitModule: QuickSwapKitModule = {
    identifier: 'snapmaker-2.0-quick-swap-module',

    name: 'key-App/Settings/MachineSettings-Snapmaker 2.0 Quick Swap Kit',

    metadata: {

    }
};

export const bracingKitModule: BracingKit = {
    identifier: 'snapmaker-2.0-bracing-kit-module',

    name: 'key-App/Settings/MachineSettings-Snapmaker 2.0 Bracing Kit',

    metadata: {

    }
};
