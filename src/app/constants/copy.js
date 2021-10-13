// mock function i18n to force variables to be counted as i18n words
const i18n = {
    _: () => {}
};

// machine size name
// TODO, no used
i18n._('key-Luban/Machine/MachineSeries-Snapmaker Original');
i18n._('key-Luban/Machine/MachineSeries-Snapmaker Original with Z-axis Extension Module');
i18n._('key-Luban/Machine/MachineSeries-Snapmaker 2.0 A150');
i18n._('key-Luban/Machine/MachineSeries-Snapmaker 2.0 A250');
i18n._('key-Luban/Machine/MachineSeries-Snapmaker 2.0 A350');
i18n._('key-Luban/Machine/MachineSeries-Custom');

// coordinate size name
i18n._('key-CncLaser/JobSetup-Center');
i18n._('key-CncLaser/JobSetup-Bottom Left');
i18n._('key-CncLaser/JobSetup-Top Right');
i18n._('key-CncLaser/JobSetup-Bottom Right');
i18n._('key-CncLaser/JobSetup-Top Left');
i18n._('key-CncLaser/JobSetup-Top');

// main menu
i18n._('key-App/Menu-File');
i18n._('key-App/Menu-New Project');
i18n._('key-App/Menu-3D Printing');
i18n._('key-App/Menu-Laser');
i18n._('key-App/Menu-3-axis');
i18n._('key-App/Menu-4-axis');
i18n._('key-App/Menu-CNC');
i18n._('key-App/Menu-3-axis');
i18n._('key-App/Menu-4-axis');
i18n._('key-App/Menu-Open Project');
i18n._('key-App/Menu-Recent Project');
i18n._('key-App/Menu-Clear All Recent Projects');
i18n._('key-App/Menu-Case Library');
i18n._('key-App/Menu-Save Project');
i18n._('key-App/Menu-Save As');
i18n._('key-App/Menu-Import Object');
i18n._('key-App/Menu-Export Object');
i18n._('key-App/Menu-Export G-code');
i18n._('key-App/Menu-Exit');
i18n._('key-App/Menu-Window');
i18n._('key-App/Menu-Reload');
i18n._('key-App/Menu-Force Reload');
i18n._('key-App/Menu-View In Browser');
i18n._('key-App/Menu-Toggle Developer Tools');
i18n._('key-App/Menu-Toggle Fullscreen');
i18n._('key-App/Menu-Settings');
i18n._('key-App/Menu-Machine Settings');
i18n._('key-App/Menu-Language');
i18n._('key-App/Menu-Preferences');

i18n._('key-App/Menu-Edit');
i18n._('key-App/Menu-Undo');
i18n._('key-App/Menu-Redo');
i18n._('key-App/Menu-Cut');
i18n._('key-App/Menu-Copy');
i18n._('key-App/Menu-Duplicate');
i18n._('key-App/Menu-Paste');
i18n._('key-App/Menu-Select All');
i18n._('key-App/Menu-Unselect');
i18n._('key-App/Menu-Delete');
i18n._('key-App/Menu-Text-editor');
i18n._('key-App/Menu-Cut Original');
i18n._('key-App/Menu-Copy Original');
i18n._('key-App/Menu-Paste Original');

i18n._('key-App/Menu-Help');
i18n._('key-App/Menu-Software Manual');
i18n._('key-App/Menu-Video Tutorial');
i18n._('key-App/Menu-Snapmaker.com');
i18n._('key-App/Menu-MyMiniFactory');
i18n._('key-App/Menu-Support');
i18n._('key-App/Menu-Forum');
i18n._('key-App/Menu-Store');
i18n._('key-App/Menu-Software Update');
i18n._('key-App/Menu-Firmware Tool');
i18n._('key-App/Menu-Beginners Guide');

// case lib
i18n._('key-HomePage/CaseLibrary-Fabric');
i18n._('key-HomePage/CaseLibrary-Feather');
i18n._('key-HomePage/CaseLibrary-Sign');
i18n._('key-HomePage/CaseLibrary-Spiral Vase');
i18n._('key-HomePage/CaseLibrary-Gift Box');
i18n._('key-HomePage/CaseLibrary-Keychain');
i18n._('key-HomePage/CaseLibrary-Phone Holder');
i18n._('key-HomePage/CaseLibrary-Knight Chess Piece');
i18n._('key-HomePage/CaseLibrary-Lion Chess Piece');
i18n._('key-HomePage/CaseLibrary-Lion Box');

// 3dp material default name
i18n._('key-unused-PLA');
i18n._('key-unused-ABS');
i18n._('key-unused-PETG');

// CNC stl Orientation
i18n._('key-Cnc/StlSection/orientation_Front-Front');
i18n._('key-Cnc/StlSection/orientation_Back-Back');
i18n._('key-Cnc/StlSection/orientation_Left-Left');
i18n._('key-Cnc/StlSection/orientation_Right-Right');
i18n._('key-Cnc/StlSection/orientation_Top-Top');
i18n._('key-Cnc/StlSection/orientation_Bottom-Bottom');

// CNC ToolPath
i18n._('Allowance');
i18n._('Set the amount of the material remaining on the object that needs to be carved in future operations.');
i18n._('Slicing Mode');
i18n._('Method');
i18n._('Target Depth');
i18n._('Set the depth of the object to be carved. The depth should be smaller than the flute length.');
i18n._('Jog Height');
i18n._('Set the distance between the tool and the material when the tool is not carving.');
i18n._('Stop Height');
i18n._('Set the distance between the tool and the material when the tool stops.');
i18n._('Use Tab');
i18n._('Use tabs to hold the pieces in place.');
i18n._('Tab Height');
i18n._('Set the height of tabs.');
i18n._('Tab Space');
i18n._('Set the distance between each tab.');
i18n._('Tab Width');
i18n._('Set the width of tabs.');
i18n._('Stepover');
i18n._('Set the space between parallel toolpaths.');
i18n._('Work Speed');
i18n._('Set the speed at which the tool moves on the material when it is carving.');
i18n._('Plunge Speed');
i18n._('Set the speed at which the tool is driven down into the material.');
i18n._('Jog Speed');
i18n._('Set the speed at which the tool moves on the material when it is not carving.');
i18n._('Stepdown');
i18n._('Set the distance along the Z axis per step that the tool is plunged into the material.');

// CNC tool setting
i18n._('key-Cnc/ToolManger-Tool Settings');
i18n._('Carving Tool');
i18n._('Parameters');

// connection message
i18n._('key-Workspace/Connection-enclosure');
i18n._('key-Workspace/Connection-rotaryModule');
i18n._('key-Workspace/Connection-emergencyStopButton');
// TOOL HEAD
i18n._('key-Workspace/Connection-TOOLHEAD_3DPPRINTING_1');
i18n._('key-Workspace/Connection-TOOLHEAD_LASER_1');
i18n._('key-Workspace/Connection-TOOLHEAD_LASER_2');
i18n._('key-Workspace/Connection-TOOLHEAD_CNC_1');
i18n._('key-Workspace/Connection-10W Laser');
