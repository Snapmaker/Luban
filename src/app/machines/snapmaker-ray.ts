import { Machine, MachineType, ToolHead, ToolHeadType } from '@snapmaker/luban-platform';

export const laserModule20W: ToolHead = {
    identifier: '20W Laser Module',

    label: '20W',
    image: '/resources/images/machine/snapmaker_j1_dual_extruders.png',

    metadata: {
        headType: ToolHeadType.Laser,

        numberOfExtruders: 0,
    },
};

export const laserModule40W: ToolHead = {
    identifier: '40W Laser Module',

    label: '40W',
    image: '/resources/images/machine/snapmaker_j1_dual_extruders.png',

    metadata: {
        headType: ToolHeadType.Laser,

        numberOfExtruders: 0,
    },
};


export const machine: Machine = {
    identifier: 'Ray',

    fullName: 'Snapmaker Ray',
    machineType: MachineType.Laser,

    img: '/resources/images/machine/size-2.0-A350.jpg',

    metadata: {
        size: { x: 200, y: 200, z: 10 },

        toolHeads: [
            {
                identifier: laserModule20W.identifier,
                configPath: 'laser/snapmaker_ray_20w',
            },
            {
                identifier: laserModule40W.identifier,
                configPath: 'laser/snapmaker_ray_40w',
            },
        ],
    },
};
