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
i18n._('key_constants/copy_Fabric');
i18n._('key_constants/copy_Feather');
i18n._('key_constants/copy_Sign');
i18n._('key_constants/copy_Spiral Vase');
i18n._('key_constants/copy_Gift Box');
i18n._('key_constants/copy_Keychain');
i18n._('key_constants/copy_Phone Holder');
i18n._('key_constants/copy_Knight Chess Piece');
i18n._('key_constants/copy_Lion Chess Piece');
i18n._('key_constants/copy_Lion Box');

// 3dp material default name
i18n._('key_constants/copy_PLA');
i18n._('key_constants/copy_ABS');
i18n._('key_constants/copy_PETG');

// CNC stl Orientation
i18n._('key_constants/copy_Front');
i18n._('key_constants/copy_Back');
i18n._('key_constants/copy_Left');
i18n._('key_constants/copy_Right');
i18n._('key_constants/copy_Top');
i18n._('key_constants/copy_Bottom');

// Laser ToolPath
i18n._('Set the processing method of the object. \n - Fill: Fills the object with lines or dots.\n - On the Path: Engraves along the shape of the object.');
i18n._('key_constants/copy_Method');
i18n._('key_constants/copy_Work Speed');
i18n._('key_constants/copy_Set the speed at which the toolhead moves on the material when it is engraving or cutting.');
i18n._('key_constants/copy_Number of Passes');
i18n._('key_constants/copy_Set how many times the laser will trace the same path in a G-code file.');
i18n._('key_constants/copy_Z Step per Pass');
i18n._('key_constants/copy_Set the amount at which the Laser Module is lowered with each pass.');
i18n._('key_constants/copy_Laser Power');
i18n._('key_constants/copy_Set the laser power.');
i18n._('key_constants/copy_Movement Mode');
i18n._('key_constants/copy_Set whether the object is filled with lines or dots.');
i18n._('key_constants/copy_Fill Interval');
i18n._('key_constants/copy_Set the degree to which an area is filled with laser lines or dots. The minimal interval is 0.05 mm.');
i18n._('key_constants/copy_Fill Density');
i18n._('key_constants/copy_Set the precision at which an area is carved. The highest density is 0.05 mm (20 dot/mm). When it is set to 0, the SVG image will be carved without fill.');
i18n._('key_constants/copy_Density');
i18n._('Determines how fine and smooth the engraved picture will be. \
The bigger this value is, the better quality you will get. The range is 1-10 dot/mm and 10 is recommended.');
i18n._('key_constants/copy_Dwell Time');
i18n._('key_constants/copy_Determines how long the laser keeps on when it’s engraving a dot.');
i18n._('key_constants/copy_Jog Speed');
i18n._('key_constants/copy_Set the speed at which the toolhead moves on the material when it is not engraving or cutting.');
i18n._('key_constants/copy_Line Direction');
i18n._('key_constants/copy_Set the direction of the engraved path. Engraves the path in a horizontal, vertical, or diagonal direction.');
i18n._('key_constants/copy_Horizontal');
i18n._('key_constants/copy_Vertical');
i18n._('key_constants/copy_Diagonal');
i18n._('key_constants/copy_Diagonal2');

// CNC ToolPath
i18n._('key_constants/copy_Allowance');
i18n._('key_constants/copy_Set the amount of the material remaining on the object that needs to be carved in future operations.');
i18n._('key_constants/copy_Slicing Mode');
i18n._('key_constants/copy_Select the slicing mode of the mesh toolpath');
i18n._('key_constants/copy_Method');
i18n._('Set the processing method of the object.\n -On the Path: Carves along the shape of the object. \n -Outline: Carves along the outline of the object.\n -Fill: Carves away the inner area of the object.');
i18n._('key_constants/copy_Target Depth');
i18n._('key_constants/copy_Set the depth of the object to be carved. The depth should be smaller than the flute length.');
i18n._('key_constants/copy_Jog Height');
i18n._('key_constants/copy_Set the distance between the tool and the material when the tool is not carving.');
i18n._('key_constants/copy_Stop Height');
i18n._('key_constants/copy_Set the distance between the tool and the material when the tool stops.');
i18n._('key_constants/copy_Use Tab');
i18n._('key_constants/copy_Use tabs to hold the pieces in place.');
i18n._('key_constants/copy_Tab Height');
i18n._('key_constants/copy_Set the height of tabs.');
i18n._('key_constants/copy_Tab Space');
i18n._('key_constants/copy_Set the distance between each tab.');
i18n._('key_constants/copy_Tab Width');
i18n._('key_constants/copy_Set the width of tabs.');
i18n._('key_constants/copy_Stepover');
i18n._('key_constants/copy_Set the space between parallel toolpaths.');
i18n._('key_constants/copy_Work Speed');
i18n._('key_constants/copy_Set the speed at which the tool moves on the material when it is carving.');
i18n._('key_constants/copy_Plunge Speed');
i18n._('key_constants/copy_Set the speed at which the tool is driven down into the material.');
i18n._('key_constants/copy_Jog Speed');
i18n._('key_constants/copy_Set the speed at which the tool moves on the material when it is not carving.');
i18n._('key_constants/copy_Stepdown');
i18n._('key_constants/copy_Set the distance along the Z axis per step that the tool is plunged into the material.');

// CNC tool setting
i18n._('key_constants/copy_Tool Settings');
i18n._('key_constants/copy_Cutting Diameter');
i18n._('key_constants/copy_Set the diameter of the carving tool.');
i18n._('key_constants/copy_Point Angle');
i18n._('key_constants/copy_Set the point angle of the carving tool.');
i18n._('key_constants/copy_Shank Diameter');
i18n._('key_constants/copy_Set the shank diameter of the carving tool.');
i18n._('key_constants/copy_Carving Tool');
i18n._('key_constants/copy_Parameters');
