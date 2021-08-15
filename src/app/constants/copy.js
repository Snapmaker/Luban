// mock function i18n to force variables to be counted as i18n words
const i18n = {
    _: () => {}
};

// quality name
i18n._('Fast Print');
i18n._('Normal Quality');
i18n._('High Quality');
// machine size name
i18n._('Snapmaker Original');
i18n._('Snapmaker Original');
i18n._('Snapmaker Original with Z-axis Extension Module');
i18n._('Snapmaker 2.0 A150');
i18n._('Snapmaker 2.0 A250');
i18n._('Snapmaker 2.0 A350');
i18n._('Custom');

// coordinate size name
i18n._('Center');
i18n._('Bottom Left');
i18n._('Top Right');
i18n._('Bottom Right');
i18n._('Top Left');
i18n._('Top');

// main menu
i18n._('File');
i18n._('New Project');
i18n._('3D Printing');
i18n._('Laser');
i18n._('3-axis');
i18n._('4-axis');
i18n._('CNC');
i18n._('3-axis');
i18n._('4-axis');
i18n._('Open Project');
i18n._('Recent Project');
i18n._('Clear All Recent Projects');
i18n._('Case Library');
i18n._('Save Project');
i18n._('Save As');
i18n._('Import Object');
i18n._('Export Object');
i18n._('Export G-code');
i18n._('Exit');

// case lib
i18n._('Fabric');
i18n._('Feather');
i18n._('Sign');
i18n._('Spiral Vase');
i18n._('Gift Box');
i18n._('Keychain');
i18n._('Phone Holder');
i18n._('Knight Chess Piece');
i18n._('Lion Chess Piece');
i18n._('Lion Box');

// 3dp material default name
i18n._('PLA');
i18n._('ABS');
i18n._('PETG');

// CNC stl Orientation
i18n._('Front');
i18n._('Back');
i18n._('Left');
i18n._('Right');
i18n._('Top');
i18n._('Bottom');

// Laser ToolPath
i18n._('Set the processing method of the object. \n - Fill: Fills the object with lines or dots.\n - On the Path: Engraves along the shape of the object.');
i18n._('Method');
i18n._('Work Speed');
i18n._('Set the speed at which the toolhead moves on the material when it is engraving or cutting.');
i18n._('Number of Passes');
i18n._('Set how many times the laser will trace the same path in a G-code file.');
i18n._('Z Step per Pass');
i18n._('Set the amount at which the Laser Module is lowered with each pass.');
i18n._('Laser Power');
i18n._('Set the laser power.');
i18n._('Movement Mode');
i18n._('Set whether the object is filled with lines or dots.');
i18n._('Fill Interval');
i18n._('Set the degree to which an area is filled with laser lines or dots. The minimal interval is 0.05 mm.');
i18n._('Fill Density');
i18n._('Set the precision at which an area is carved. The highest density is 0.05 mm (20 dot/mm). When it is set to 0, the SVG image will be carved without fill.');
i18n._('Density');
i18n._('Determines how fine and smooth the engraved picture will be. \
The bigger this value is, the better quality you will get. The range is 1-10 dot/mm and 10 is recommended.');
i18n._('Dwell Time');
i18n._('Determines how long the laser keeps on when it’s engraving a dot.');
i18n._('Jog Speed');
i18n._('Set the speed at which the toolhead moves on the material when it is not engraving or cutting.');
i18n._('Line Direction');
i18n._('Set the direction of the engraved path. Engraves the path in a horizontal, vertical, or diagonal direction.');
i18n._('Horizontal');
i18n._('Vertical');
i18n._('Diagonal');
i18n._('Diagonal2');

// CNC ToolPath
i18n._('Allowance');
i18n._('Set the amount of the material remaining on the object that needs to be carved in future operations.');
i18n._('Slicing Mode');
i18n._('Select the slicing mode of the mesh toolpath');
i18n._('Method');
i18n._('Choose carving path');
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
i18n._('Tool Settings');
i18n._('Cutting Diameter');
i18n._('Set the diameter of the carving tool.');
i18n._('Point Angle');
i18n._('Set the point angle of the carving tool.');
i18n._('Shank Diameter');
i18n._('Set the shank diameter of the carving tool.');
i18n._('Carving Tool');
i18n._('Parameters');
