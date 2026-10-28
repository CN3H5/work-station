#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <delayimp.h>
#include <string.h>
// Electron exports Node-API from its own executable, not a separate node.exe.
static FARPROC WINAPI ResolveNode(unsigned event, PDelayLoadInfo info) {
  if (event == dliNotePreLoadLibrary && _stricmp(info->szDll, "node.exe") == 0)
    return reinterpret_cast<FARPROC>(GetModuleHandleW(nullptr));
  return nullptr;
}
decltype(__pfnDliNotifyHook2) __pfnDliNotifyHook2 = ResolveNode;
