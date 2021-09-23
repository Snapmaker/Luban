// mock function i18n to force variables to be counted as i18n words
const i18n = {
    _: () => {}
};

// machine size name
// TODO, no used
i18n._('key_machine_series_Snapmaker Original');
i18n._('key_machine_series_Snapmaker Original with Z-axis Extension Module');
i18n._('key_machine_series_Snapmaker 2.0 A150');
i18n._('key_machine_series_Snapmaker 2.0 A250');
i18n._('key_machine_series_Snapmaker 2.0 A350');
i18n._('key_machine_series_Custom');

// coordinate size name
i18n._('key_job_setup_option_Center');
i18n._('key_job_setup_option_Bottom Left');
i18n._('key_job_setup_option_Top Right');
i18n._('key_job_setup_option_Bottom Right');
i18n._('key_job_setup_option_Top Left');
i18n._('key_job_setup_option_Top');

// main menu
i18n._('key_menu_File');
i18n._('key_menu_New Project');
i18n._('key_menu_3D Printing');
i18n._('key_menu_Laser');
i18n._('key_menu_3-axis');
i18n._('key_menu_4-axis');
i18n._('key_menu_CNC');
i18n._('key_menu_3-axis');
i18n._('key_menu_4-axis');
i18n._('key_menu_Open Project');
i18n._('key_menu_Recent Project');
i18n._('key_menu_Clear All Recent Projects');
i18n._('key_menu_Case Library');
i18n._('key_menu_Save Project');
i18n._('key_menu_Save As');
i18n._('key_menu_Import Object');
i18n._('key_menu_Export Object');
i18n._('key_menu_Export G-code');
i18n._('key_menu_Exit');
i18n._('key_menu_Window');
i18n._('key_menu_Reload');
i18n._('key_menu_Force Reload');
i18n._('key_menu_View In Browser');
i18n._('key_menu_Toggle Developer Tools');
i18n._('key_menu_Toggle Fullscreen');
i18n._('key_menu_Settings');
i18n._('key_menu_Machine Settings');
i18n._('key_menu_Language');
i18n._('key_menu_Preferences');

i18n._('key_menu_Edit');
i18n._('key_menu_Undo');
i18n._('key_menu_Redo');
i18n._('key_menu_Cut');
i18n._('key_menu_Copy');
i18n._('key_menu_Duplicate');
i18n._('key_menu_Paste');
i18n._('key_menu_Select All');
i18n._('key_menu_Unselect');
i18n._('key_menu_Delete');
i18n._('key_menu_Text-editor');
i18n._('key_menu_Cut Original');
i18n._('key_menu_Copy Original');
i18n._('key_menu_Paste Original');

i18n._('key_menu_Help');
i18n._('key_menu_Software Manual');
i18n._('key_menu_Video Tutorial');
i18n._('key_menu_Snapmaker.com');
i18n._('key_menu_MyMiniFactory');
i18n._('key_menu_Software Support');
i18n._('key_menu_Forum');
i18n._('key_menu_Shopify');
i18n._('key_menu_Software Update');
i18n._('key_menu_Firmware Tool');
i18n._('key_menu_Beginners Guide');

// case lib
i18n._('key_case_library_Fabric');
i18n._('key_case_library_Feather');
i18n._('key_case_library_Sign');
i18n._('key_case_library_Spiral Vase');
i18n._('key_case_library_Gift Box');
i18n._('key_case_library_Keychain');
i18n._('key_case_library_Phone Holder');
i18n._('key_case_library_Knight Chess Piece');
i18n._('key_case_library_Lion Chess Piece');
i18n._('key_case_library_Lion Box');

// 3dp material default name
i18n._('key_constants/copy_PLA');
i18n._('key_constants/copy_ABS');
i18n._('key_constants/copy_PETG');

// CNC stl Orientation
i18n._('key_cnc_stl_orientation_Front');
i18n._('key_cnc_stl_orientation_Back');
i18n._('key_cnc_stl_orientation_Left');
i18n._('key_cnc_stl_orientation_Right');
i18n._('key_cnc_stl_orientation_Top');
i18n._('key_cnc_stl_orientation_Bottom');

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
i18n._('key_cnc_tool_settings_Tool Settings');
i18n._('Carving Tool');
i18n._('Parameters');
