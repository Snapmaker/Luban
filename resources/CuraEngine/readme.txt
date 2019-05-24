1. if you had cd the dir of CuraEngine, you can call CuraEngine like the followings

PS:snapmaker.def.json, test.stl must be in the same dir
or find stl and json by ../xx/xxx.def.jsons

mac
./CuraEngine slice -v -p -j "snapmaker.def.json" -o "mac.gcode" -l "test.stl"

win
CuraEngine.exe slice -v -p -j "snapmaker.def.json" -o "win.gcode" -l "test.stl"

2. use abs path
CuraEngine, json, stl and gcode


