import { Machine, MachineType, ToolHead, ToolHeadType } from '@snapmaker/luban-platform';

export const laserModule20W: ToolHead = {
    identifier: '20W Laser Module',

    label: '20W',
    image: '/resources/images/machine/coming_soon.png',

    metadata: {
        headType: ToolHeadType.Laser,

        numberOfExtruders: 0,
    },
};

export const laserModule40W: ToolHead = {
    identifier: '40W Laser Module',

    label: '40W',
    image: '/resources/images/machine/coming_soon.png',

    metadata: {
        headType: ToolHeadType.Laser,

        numberOfExtruders: 0,
    },
};


export const machine: Machine = {
    identifier: 'Ray',

    fullName: 'Snapmaker Ray',
    machineType: MachineType.Laser,

    img: '/resources/images/machine/coming_soon.png',

    metadata: {
        size: { x: 400, y: 600, z: 30 },

        toolHeads: [
            {
                identifier: laserModule20W.identifier,
                configPath: 'laser/snapmaker_ray_20w',
                goHomeOnConnection: false,
            },
            {
                identifier: laserModule40W.identifier,
                configPath: 'laser/snapmaker_ray_40w',
                goHomeOnConnection: false,
            },
        ],
    },
};
