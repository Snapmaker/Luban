export enum PageMode {
    Default = 'Default',

    // 3D Printing
    // print mode
    ChangePrintMode = 'ChangePrintMode',

    // Simplify mode: Simplify selected models
    Simplify = 'Simplify',

    // Case Resource Download Manager
    DownloadManager = 'DownloadManager',

    // Support mode: Toggle between "Auto Support" and "Edit Support"
    Support = 'Support',

    // Edit Support mode: Draw area to generate support
    EditSupport = 'EditSupport',

    // Mesh Coloring mode: Coloring mesh for multiple materials printing
    MeshColoring = 'MeshColoring',

    // Laser
    // Print mode
    SVGClipping = 'SVGClipping',
}
