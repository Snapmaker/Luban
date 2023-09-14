import { noop } from 'lodash';

// mock function i18n to force variables to be counted as i18n words
const i18n = {
    _: noop,
};

// preset label
i18n._('key-Luban/Preset/Layer Height');
i18n._('key-Luban/Preset/Print Speed');
i18n._('key-Luban/Preset/Infill Density');
i18n._('key-Luban/Preset/Model Structure Type');
i18n._('key-Luban/Preset/Support Type');
i18n._('key-Luban/Preset/Build Plate Adhesion Type');
i18n._('key-Luban/Preset/Layer Height-Fine');
i18n._('key-Luban/Preset/Layer Height-Medium');
i18n._('key-Luban/Preset/Layer Height-Rough');
i18n._('key-Luban/Preset/Print Speed-Slow');
i18n._('key-Luban/Preset/Print Speed-Medium');
i18n._('key-Luban/Preset/Print Speed-Fast');
i18n._('key-Luban/Preset/Model Structure-Thin');
i18n._('key-Luban/Preset/Model Structure-Medium');
i18n._('key-Luban/Preset/Model Structure-Strong');
i18n._('key-Luban/Preset/Support Type-Normal');
i18n._('key-Luban/Preset/Support Type-None');

i18n._('key-PrintingCncLaser/ObjectList-This is a deficient model. Select it and click Repair.');
i18n._('key-App/Settings/MachineSettings-3D Printing');
i18n._('key-App/Settings/MachineSettings-Laser');
i18n._('key-App/Settings/MachineSettings-CNC');
// machine size name
i18n._('key-Luban/Machine/MachineSeries-Snapmaker Original');
i18n._('key-Luban/Machine/MachineSeries-Snapmaker Original with Z-axis Extension Module');
i18n._('key-Luban/Machine/MachineSeries-Snapmaker 2.0 A150');
i18n._('key-Luban/Machine/MachineSeries-Snapmaker 2.0 A250');
i18n._('key-Luban/Machine/MachineSeries-Snapmaker 2.0 A350');
i18n._('key-Luban/Machine/MachineSeries-Snapmaker Artisan');

// machine name without brand
i18n._('key-Luban/Machine/MachineSeries-Original');
i18n._('key-Luban/Machine/MachineSeries-A150');
i18n._('key-Luban/Machine/MachineSeries-A250');
i18n._('key-Luban/Machine/MachineSeries-A350');

// machine brand
i18n._('key-Luban/Machine/Brand-Original');
i18n._('key-Luban/Machine/Brand-Snapmaker');
i18n._('key-Luban/Machine/Brand-Snapmaker 2.0');

i18n._('key-machine_selection-Workspace');
i18n._('key-machine_selection-3D Printing');
i18n._('key-machine_selection-Laser');
i18n._('key-machine_selection-10W Laser');
i18n._('key-machine_selection-CNC');

// coordinate size name
i18n._('key-CncLaser/JobSetup-Center');
i18n._('key-CncLaser/JobSetup-Bottom Left');
i18n._('key-CncLaser/JobSetup-Top Right');
i18n._('key-CncLaser/JobSetup-Bottom Right');
i18n._('key-CncLaser/JobSetup-Top Left');
i18n._('key-CncLaser/JobSetup-Top');

// main menu
i18n._('key-App/Menu-Preferences');
i18n._('key_menu_About');
i18n._('key_menu_Services');
i18n._('key_menu_Hide');
i18n._('key_menu_Hide Others');
i18n._('key_menu_Unhide');
i18n._('key_menu_Quit');

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

// help menu
i18n._('key-App/Menu-Help');
i18n._('key-App/Menu-Software Manual');
i18n._('key-App/Menu-Video Tutorial');
i18n._('key-App/Menu-Visit Official Website');
i18n._('key-App/Menu-MyMiniFactory');
i18n._('key-App/Menu-Support');
i18n._('key-App/Menu-Forum');
i18n._('key-App/Menu-Store');
i18n._('key-App/Menu-Software Update');
i18n._('key-App/Menu-Reset Configurations');
i18n._('key-App/Menu-Firmware Tool');
i18n._('key-App/Menu-Beginners Guide');
i18n._('key-App/Menu-Backup config');
i18n._('key-App/Menu-Download Logs');
i18n._('key-App/Menu-Run Engine Test');
i18n._('key-App/Menu-Run Wifi Test');
i18n._('key-App/Menu-Open Config Folder');

// case lib
i18n._('key-HomePage/CaseLibrary_title-3DP');
i18n._('key-HomePage/CaseLibrary_title-CNC');
i18n._('key-HomePage/CaseLibrary_title-Laser');
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
i18n._('key-HomePage/CaseLibrary-wood rule');
i18n._('key-HomePage/CaseLibrary-aluminum fox');
i18n._('key-HomePage/CaseLibrary-wood Turtle Jigsaw');
i18n._('key-HomePage/CaseLibrary-wood rhino jigsaw');
i18n._('key-HomePage/CaseLibrary-acrylic rhino jigsaw');
i18n._('key-HomePage/CaseLibrary-Pen Holder');
i18n._('key-HomePage/CaseLibrary-Luban Lock');

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
i18n._('Select the slicing mode of the mesh toolpath');
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
i18n._('Color');
i18n._('Set Luban render color.');

i18n._('On the Path');
i18n._('Outline');
i18n._('Fill');
i18n._('Set the processing method of the object.\n -On the Path: Carves along the shape of the object. \n -Outline: Carves along the outline of the object.\n -Fill: Carves away the inner area of the object.');

// Laser ToolPath
i18n._('key-Laser/ToolpathParameters-Method');
i18n._('key-Laser/PresetManager-Preset Settings');

// CNC tool setting
i18n._('key-Cnc/ToolManger-Tool Settings');
i18n._('Carving Tool');
i18n._('Parameters');

// Printing Profile
i18n._('key-Printing/PrintingConfigurations-Customized');
i18n._('key-Printing/PrintingConfigurations-Recommended');

i18n._('key-printing/material_settings-Temperature');
i18n._('key-printing/material_settings-Extrusion');
i18n._('key-Printing/LeftBar-Extruder Both');
i18n._('key-Printing/PrintingConfigurations-Material Settings');

// Profile Default name and category
i18n._('key-default_name-Carving V-bit');
i18n._('key-default_name-Flat End Mill 1.5');
i18n._('key-default_name-Flat End Mill 3.175');
i18n._('key-default_name-Ball End Mill');
i18n._('key-default_name-Straight Groove V-bit');

i18n._('key-default_name-CUT');
i18n._('key-default_name-HD Fill');
i18n._('key-default_name-Path Engrave');
i18n._('key-default_name-SD Fill');
i18n._('key-default_name-Cutting 1.5mm');
i18n._('key-default_name-Cutting 3mm');
i18n._('key-default_name-Cutting 5mm');
i18n._('key-default_name-Cutting 8mm');
i18n._('key-default_name-Cutting 10mm');
i18n._('key-default_name-Dot-filled Engraving');
i18n._('key-default_name-Line-filled Engraving');
i18n._('key-default_name-Fast-Line-filled Engraving');
i18n._('key-default_name-Vector Engraving');
i18n._('key-default_name-Cutting 2mm');
i18n._('key-default_name-Cutting 3mm');
i18n._('key-default_name-Cutting 5mm');
i18n._('key-default_name-Cutting 200g');
i18n._('key-default_name-Cutting 300g');
i18n._('key-default_name-Cutting 350g');
i18n._('key-default_name-Cutting 1.6mm');
i18n._('key-default_name-Cutting 4mm');

i18n._('key-default_name-ABS');
i18n._('key-default_name-PETG');
i18n._('key-default_name-PLA');
i18n._('key-default_category-TPU');
i18n._('key-default_name-Fast Print');
i18n._('key-default_name-Normal Print');
i18n._('key-default_name-Normal Print (Others)');
i18n._('key-default_name-Normal Print (PLA/ABS/PETG)');
i18n._('key-default_name-Normal Print (TPU)');
i18n._('key-default_name-Precise & Strong');
i18n._('key-default_name-Smooth Surface');
i18n._('key-default_name-Normal Quality');
i18n._('key-default_name-High Quality');
i18n._('key-default_name-ABS_Black');
i18n._('key-default_name-ABS_White');
i18n._('key-default_name-PLA_Black');
i18n._('key-default_name-PLA_White');
i18n._('key-default_name-PLA_Blue');
i18n._('key-default_name-PLA_Grey');
i18n._('key-default_name-PLA_Red');
i18n._('key-default_name-PLA_Wood');
i18n._('key-default_name-PLA_Glow');
i18n._('key-default_name-PLA_Yellow');
i18n._('key-default_name-PLA_Orange');
i18n._('key-default_name-PETG_Black');
i18n._('key-default_name-PETG_White');
i18n._('key-default_name-PETG_Blue');
i18n._('key-default_name-PETG_Red');
i18n._('key-default_name-TPU_Black');
i18n._('key-default_name-TPU_Yellow');
i18n._('key-default_name-Breakaway Support-White');
i18n._('key-default_name-PVA_White');
i18n._('key-default_name-PC');
i18n._('key-default_name-ASA');
i18n._('key-default_name-Other');
i18n._('key-default_name-Nylon-CoPA');
i18n._('key-default_name-Nylon-PA6-CF');
i18n._('key-default_category-Default Material');
i18n._('key-default_category-Acrylic');
i18n._('key-default_category-Epoxy Tooling Board');
i18n._('key-default_category-Default Preset');

i18n._('key-default_category-Basswood');
i18n._('key-default_category-Black Acrylic');
i18n._('key-default_category-Black Anodized Aluminum');
i18n._('key-default_category-Cardstock');
i18n._('key-default_category-Coated Paper');
i18n._('key-default_category-Corrugated Paper');
i18n._('key-default_category-Crazy Horse Leather');
i18n._('key-default_category-MDF');
i18n._('key-default_category-Pinewood');
i18n._('key-default_category-Vegetable Tanned Leather');

i18n._('key-default_category-Default');
i18n._('key-default_category-Custom');
i18n._('key-default_category-PLA');
i18n._('key-default_category-PETG');
i18n._('key-default_category-ABS');
i18n._('key-default_category-PVA');
i18n._('key-default_category-PC');
i18n._('key-default_category-ASA');
i18n._('key-default_category-Support');
i18n._('key-default_category-Other');
i18n._('key-default_category-Nylon');

// connection message
i18n._('key-Workspace/Connection-The machine or toolhead cannot be correctly recognized. Make sure the firmware is up to date and the machine is wired correctly.');
i18n._('key-Workspace/Connection-enclosure');
i18n._('key-Workspace/Connection-rotaryModule');
i18n._('key-Workspace/Connection-emergencyStopButton');
// TOOL HEAD
i18n._('key-Workspace/Connection-TOOLHEAD_3DPRINTING_1');
i18n._('key-Workspace/Connection-TOOLHEAD_LASER_1');
i18n._('key-Workspace/Connection-TOOLHEAD_LASER_2');
i18n._('key-Workspace/Connection-TOOLHEAD_CNC_1');
i18n._('key-Workspace/Connection-Laser-10W');
i18n._('key-Workspace/Connection-3dp');
i18n._('key-Workspace/Connection-Laser');
i18n._('Key-Workspace/LaserStartJob-manual_mode_description');
i18n._('key-Workspace/Marlin-Left Nozzle Temp');

// Progress Manager
i18n._('key-Progress/LaserCNC-Generate toolpath and preview: {{progress}}%');
i18n._('key-Progress/LaserCNC-Generated toolpath and previewed successfully.');
i18n._('key-Progress/LaserCNC-Failed to generate toolpath and preview.');
i18n._('key-Progress/LaserCNC-Loading object {{progress}}%');
i18n._('key-Progress/LaserCNC-Loaded object successfully.');
i18n._('key-Progress/LaserCNC-Failed to load object.');
i18n._('key-Progress/LaserCNC-Processing object {{progress}}%');
i18n._('key-Progress/LaserCNC-Processed object successfully.');
i18n._('key-Progress/LaserCNC-Failed to process object.');
i18n._('key-Progress/LaserCNC-Generating simulation {{progress}}%');
i18n._('key-Progress/LaserCNC-Generated simulation successfully.');
i18n._('key-Progress/LaserCNC-Failed to generate simulation.');
i18n._('key-Progress/LaserCNC-Processing SVG {{progress}}%');
i18n._('key-Progress/LaserCNC-Processing SVG successfully.');
i18n._('key-Progress/LaserCNC-Failed to process SVG.');


i18n._('key-Progress/Laser-Loading model...');
i18n._('key-Progress/Laser-Loaded model successfully.');
i18n._('key-Progress/Laser-Failed to load model.');
i18n._('key-Laser/CameraCapture-conventional mode');
i18n._('key-Laser/CameraCapture-conventional mode describe');
i18n._('key-Laser/CameraCapture-thickness compensation mode');
i18n._('key-Laser/CameraCapture-thickness compensation mode describe');
i18n._('key-Laser/CameraCapture-thickness compensation mode describe2');
i18n._('key-Laser/CameraCapture-thickness input');


i18n._('key-Progress/3DP-Loading model...{{progress}}%');
i18n._('key-Progress/3DP-Loaded model successfully.');
i18n._('key-Progress/3DP-Failed to load model.');
i18n._('key-Progress/3DP-Previewing G-code...{{progress}}%');
i18n._('key-Progress/3DP-Previewed G-code successfully.');
i18n._('key-Progress/3DP-Ordinary');
i18n._('key-Progress/3DP-SingleLayer');
i18n._('key-Progress/3DP-GrayUnderTheTopFloor');
i18n._('key-Progress/3DP-Failed to preview G-code.');
i18n._('key-Progress/3DP-Calculating Rotation');
i18n._('key-Progress/3DP-Calculated Rotation successfully.');
i18n._('key-Progress/3DP-Failed to calculate Rotation.');
i18n._('key-Progress/3DP-Generating support... {{progress}}%');
i18n._('key-Progress/3DP-Generated support successfully.');
i18n._('key-Progress/3DP-Failed to generate support.');
i18n._('key-Progress/3DP-Arranging models...{{progress}}%');
i18n._('key-Progress/3DP-Arrange models successfully.');
i18n._('key-Progress/3DP-Arrange models failed.');
i18n._('key-Progress/3DP-Auto Rotate models...{{progress}}%');
i18n._('key-Progress/3DP-Auto Rotate models successfully.');
i18n._('key-Progress/3DP-Auto Rotate models failed.');
i18n._('key-Printing/LeftBar-Auto Rotate Selected Models');
i18n._('key-Printing/LeftBar-Auto Rotate All Models');
i18n._('key-Progress/3DP-Scale to fit...{{progress}}%');
i18n._('key-Printing/3DP-Scale to fit successfully.');
i18n._('key-Printing/3DP-scale to fit failed.');
i18n._('key-Progress/3DP-Repairing model... {{progress}}%');
i18n._('key-Progress/3DP-Repair model successfully.');
i18n._('key-Progress/3DP-Failed to repair model.');
i18n._('key-Progress/3DP-Simplify model...{{prgress}}%');
i18n._('key-Progress/3DP-Preparing Mesh Painting...');
i18n._('key-Progress/3DP-Prepare successfully.');
i18n._('key-Progress/3DP-Failed to prepare mesh painting.');

i18n._('key-Progress/3DP-Splitting model...');
i18n._('key-Progress/3DP-Split model successfully.');
i18n._('key-Progress/3DP-Failed to split model.');


// Machine Settings
i18n._('key-App/Settings/MachineSettings-Single Extruder Toolhead');
i18n._('key-App/Settings/MachineSettings-200mW Laser');
i18n._('key-App/Settings/MachineSettings-1600mW Laser');
i18n._('key-App/Settings/MachineSettings-Standard CNC');
i18n._('key-App/Settings/MachineSettings-Dual Extruder Toolhead');
i18n._('key-App/Settings/MachineSettings-10W Laser');
i18n._('key-App/Settings/MachineSettings-High CNC');

i18n._('key-settings_message-update_not_ava'); // Snapmaker Luban is up to date.
i18n._('key-settings_message-updateAva'); // Updates are available.
i18n._('key-settings_message-checking'); // Checking for updates.
i18n._('key-settings_message-error'); // An error occurred while checking for updates.

i18n._('key-Printing/Modal-Backup Tip');

i18n._('key-Printing/LeftBar-No Rotation');

i18n._('key-profileManager/Params-Basic');
i18n._('key-profileManager/Params-All');
i18n._('key-profileManager/Params-Recommend');
i18n._('key-profileManager/Params-Custom');
i18n._('key-profileManager/Params-Advanced');
i18n._('key-profileManager/Params-No Limit');
i18n._('key-profileManager/Params-Efficiency');
i18n._('key-profileManager/Params-Strength');
i18n._('key-profileManager/Params-Surface_quality');
i18n._('key-profileManager/Params-Accuracy');
i18n._('key-profileManager/Params-Material');
i18n._('key-profileManager/Params-Success');
i18n._('key-Modal/Common-Ignore');
i18n._('key-Modal/Common-Do not ask me again');
i18n._('key-Printing/Repair');

// Definition Category
i18n._('key-Definition/Category-material_info');
i18n._('key-Definition/Category-heating_and_cooling');
i18n._('key-Definition/Category-flow');
i18n._('key-Definition/Category-Retraction');
i18n._('key-Definition/Category-first_layer_optimization');
i18n._('key-Definition/Category-quality');
i18n._('key-Definition/Category-printing_speed');
i18n._('key-Definition/Category-model_structure');
i18n._('key-Definition/Category-support');
i18n._('key-Definition/Category-support_adv');
i18n._('key-Definition/Category-platform_adhesion');
i18n._('key-Definition/Category-dual');
i18n._('key-Definition/Category-path_optimization');
i18n._('key-Definition/Category-model_structure_optimization');
i18n._('key-Definition/Category-unclassified');

i18n._('key-2D/Model_basename-Text');
i18n._('key-2D/Model_basename-Shape');
i18n._('key-Workspace/LaserStartJob-manual_mode_description');
